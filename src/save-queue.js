function toError(value, fallbackMessage) {
  if (value instanceof Error) {
    return value;
  }
  const error = new Error(value ? String(value) : fallbackMessage);
  return error;
}

function createAbortError(message = "Operation cancelled") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function createTimeoutError(label, timeoutMs) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

export class SaveOperationQueue {
  #tail = Promise.resolve();
  #pending = 0;
  #running = 0;
  #nextId = 1;
  #defaultTimeoutMs = 120000;
  #logger = null;

  constructor(options = {}) {
    const timeoutMs = Number(options.defaultTimeoutMs);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      this.#defaultTimeoutMs = Math.floor(timeoutMs);
    }
    this.#logger = options.logger || null;
  }

  get pendingCount() {
    return this.#pending;
  }

  get runningCount() {
    return this.#running;
  }

  enqueue(options = {}) {
    const task = options.task;
    if (typeof task !== "function") {
      throw new Error("SaveOperationQueue.enqueue requires a task function");
    }

    const label = String(options.label || "save-operation");
    const timeoutMs = Number(options.timeoutMs);
    const normalizedTimeoutMs =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.floor(timeoutMs)
        : this.#defaultTimeoutMs;

    const externalSignal = options.signal || null;
    const controller = new AbortController();
    let detachExternalAbort = null;

    if (externalSignal) {
      if (externalSignal.aborted) {
        const reason = toError(externalSignal.reason, `${label} cancelled`);
        if (reason.name !== "AbortError") {
          reason.name = "AbortError";
        }
        return Promise.reject(reason);
      }

      const onAbort = () => {
        const reason = toError(externalSignal.reason, `${label} cancelled`);
        if (reason.name !== "AbortError") {
          reason.name = "AbortError";
        }
        controller.abort(reason);
      };

      externalSignal.addEventListener("abort", onAbort, { once: true });
      detachExternalAbort = () => {
        externalSignal.removeEventListener("abort", onAbort);
      };
    }

    const jobId = this.#nextId;
    this.#nextId += 1;

    this.#pending += 1;
    this.#log("queued", {
      jobId,
      label,
      pendingCount: this.#pending,
      runningCount: this.#running
    });

    const prior = this.#tail.catch(() => undefined);
    const jobPromise = prior.then(async () => {
      this.#pending -= 1;

      if (controller.signal.aborted) {
        this.#log("cancelled_before_start", {
          jobId,
          label,
          pendingCount: this.#pending,
          runningCount: this.#running
        });
        throw toError(controller.signal.reason, `${label} cancelled before start`);
      }

      this.#running += 1;
      const startedAt = Date.now();

      this.#log("started", {
        jobId,
        label,
        pendingCount: this.#pending,
        runningCount: this.#running
      });

      let timer = null;
      let timeoutTriggered = false;
      const timeoutError = createTimeoutError(label, normalizedTimeoutMs);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timeoutTriggered = true;
          controller.abort(timeoutError);
          reject(timeoutError);
        }, normalizedTimeoutMs);
      });

      const taskPromise = Promise.resolve().then(() => task({ signal: controller.signal, jobId, label }));

      try {
        const result = await Promise.race([taskPromise, timeoutPromise]);
        const elapsedMs = Date.now() - startedAt;
        this.#log("succeeded", {
          jobId,
          label,
          elapsedMs,
          pendingCount: this.#pending,
          runningCount: this.#running
        });
        return result;
      } catch (error) {
        if (timeoutTriggered) {
          this.#log("timed_out", {
            jobId,
            label,
            timeoutMs: normalizedTimeoutMs
          });

          // Wait until task cleanup has fully settled so the queue never overlaps writes.
          try {
            await taskPromise;
          } catch (_taskError) {
            // Ignore cleanup failure and keep timeout as surfaced error.
          }
          throw timeoutError;
        }

        throw error;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
        this.#running -= 1;
        const elapsedMs = Date.now() - startedAt;
        this.#log("settled", {
          jobId,
          label,
          elapsedMs,
          pendingCount: this.#pending,
          runningCount: this.#running
        });
      }
    });

    this.#tail = jobPromise.catch(() => undefined);

    return jobPromise.finally(() => {
      if (detachExternalAbort) {
        detachExternalAbort();
      }
    });
  }

  #log(event, payload) {
    if (!this.#logger) {
      return;
    }

    if (event === "timed_out" && typeof this.#logger.warn === "function") {
      this.#logger.warn("[capture-queue]", event, payload);
      return;
    }

    if (typeof this.#logger.info === "function") {
      this.#logger.info("[capture-queue]", event, payload);
    }
  }
}

export function createAbortErrorForQueue(message) {
  return createAbortError(message);
}
