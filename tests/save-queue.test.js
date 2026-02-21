import test from "node:test";
import assert from "node:assert/strict";

import { SaveOperationQueue } from "../src/save-queue.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("SaveOperationQueue runs enqueued jobs sequentially under rapid load", async () => {
  const queue = new SaveOperationQueue({ defaultTimeoutMs: 2000 });
  const trace = [];
  let activeJobs = 0;
  let maxActiveJobs = 0;

  const jobs = Array.from({ length: 8 }, (_, index) =>
    queue.enqueue({
      label: `rapid-${index}`,
      task: async () => {
        activeJobs += 1;
        maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
        trace.push(`start-${index}`);
        await sleep(6);
        trace.push(`end-${index}`);
        activeJobs -= 1;
        return index;
      }
    })
  );

  const results = await Promise.all(jobs);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(maxActiveJobs, 1);
  assert.equal(queue.pendingCount, 0);
  assert.equal(queue.runningCount, 0);

  for (let index = 0; index < 8; index += 1) {
    const startAt = trace.indexOf(`start-${index}`);
    const endAt = trace.indexOf(`end-${index}`);
    assert.equal(startAt >= 0, true);
    assert.equal(endAt >= 0, true);
    assert.equal(endAt > startAt, true);
  }
});

test("SaveOperationQueue times out long jobs and continues with following jobs", async () => {
  const queue = new SaveOperationQueue({ defaultTimeoutMs: 25 });
  let timeoutObserved = false;

  await assert.rejects(
    queue.enqueue({
      label: "slow-job",
      task: async ({ signal }) => {
        while (!signal.aborted) {
          await sleep(5);
        }
        timeoutObserved = true;
        throw signal.reason;
      }
    }),
    (error) => {
      const maybeError = /** @type {{ name?: string }} */ (error);
      return maybeError?.name === "TimeoutError";
    }
  );

  assert.equal(timeoutObserved, true);

  const followUpResult = await queue.enqueue({
    label: "follow-up-job",
    task: async () => "ok"
  });

  assert.equal(followUpResult, "ok");
  assert.equal(queue.pendingCount, 0);
  assert.equal(queue.runningCount, 0);
});

test("SaveOperationQueue supports cancellation of queued jobs before they start", async () => {
  const queue = new SaveOperationQueue({ defaultTimeoutMs: 2000 });
  const cancelController = new AbortController();
  let cancelledTaskRan = false;

  const firstJob = queue.enqueue({
    label: "first-job",
    task: async () => {
      await sleep(40);
      return "first";
    }
  });

  const cancelledJob = queue.enqueue({
    label: "cancelled-job",
    signal: cancelController.signal,
    task: async () => {
      cancelledTaskRan = true;
      return "should-not-run";
    }
  });

  cancelController.abort("cancelled by test");

  assert.equal(await firstJob, "first");
  await assert.rejects(
    cancelledJob,
    (error) => {
      const maybeError = /** @type {{ name?: string, message?: string }} */ (error);
      return maybeError?.name === "AbortError" || /cancelled/i.test(String(maybeError?.message || ""));
    }
  );

  assert.equal(cancelledTaskRan, false);
  assert.equal(queue.pendingCount, 0);
  assert.equal(queue.runningCount, 0);
});
