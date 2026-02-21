export const LOG_LEVELS = Object.freeze(["off", "error", "info", "debug"]);

const LOG_LEVEL_PRIORITY = Object.freeze({
  off: 0,
  error: 1,
  info: 2,
  debug: 3
});

const METHOD_LEVEL = Object.freeze({
  error: "error",
  warn: "error",
  info: "info",
  debug: "debug"
});

const DEFAULT_MODULE = "app";
const DEFAULT_LOG_LEVEL = "error";
const MAX_REDACTION_DEPTH = 4;
const MAX_ARRAY_LOG_ITEMS = 20;
const MAX_REDACTED_STRING_LENGTH = 120;
const SENSITIVE_KEY_PATTERN =
  /(text|content|selected|selection|comment|note|transcript|document|annotation|payload|html|body|cookie|token|secret|password|authorization|api[_-]?key)/i;

let globalLogLevel = DEFAULT_LOG_LEVEL;

/**
 * @param {unknown} value
 * @param {string} fallback
 */
export function normalizeLogLevel(value, fallback = DEFAULT_LOG_LEVEL) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (LOG_LEVELS.includes(normalized)) {
    return normalized;
  }
  return LOG_LEVELS.includes(fallback) ? fallback : DEFAULT_LOG_LEVEL;
}

export function getGlobalLogLevel() {
  return globalLogLevel;
}

/**
 * @param {unknown} value
 */
export function setGlobalLogLevel(value) {
  globalLogLevel = normalizeLogLevel(value, DEFAULT_LOG_LEVEL);
  return globalLogLevel;
}

export function createRunId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${timestamp}-${random}`;
}

/**
 * @param {string} value
 */
function redactString(value) {
  return `[redacted:${value.length}]`;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {string} key
 * @param {boolean} redactSensitive
 */
function sanitizeValue(value, depth, key, redactSensitive) {
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (typeof value === "string") {
    if (!redactSensitive) {
      return value;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return redactString(value);
    }
    const isPositionalArg = /^arg_\d+$/.test(key);
    if ((isPositionalArg || !key) && value.length > MAX_REDACTED_STRING_LENGTH) {
      return redactString(value);
    }
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: sanitizeValue(value.message || "", depth + 1, "message", redactSensitive)
    };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_REDACTION_DEPTH) {
      return `[array:${value.length}]`;
    }
    const limited = value.slice(0, MAX_ARRAY_LOG_ITEMS);
    const output = limited.map((item) => sanitizeValue(item, depth + 1, key, redactSensitive));
    if (value.length > MAX_ARRAY_LOG_ITEMS) {
      output.push(`...${value.length - MAX_ARRAY_LOG_ITEMS} more`);
    }
    return output;
  }

  if (typeof value === "object") {
    if (depth >= MAX_REDACTION_DEPTH) {
      return "[object]";
    }
    const output = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = sanitizeValue(entryValue, depth + 1, entryKey, redactSensitive);
    }
    return output;
  }

  return String(value);
}

/**
 * @param {"error"|"warn"|"info"|"debug"} method
 * @param {string} level
 */
function shouldEmit(method, level) {
  if (level === "off") {
    return false;
  }
  const required = METHOD_LEVEL[method];
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[required];
}

/**
 * @param {unknown} sink
 * @param {"error"|"warn"|"info"|"debug"} method
 */
function resolveSinkMethod(sink, method) {
  const sinkObject = /** @type {any} */ (sink && typeof sink === "object" ? sink : {});
  const direct = sinkObject[method];
  if (typeof direct === "function") {
    return direct.bind(sinkObject);
  }
  const fallback = sinkObject.log;
  if (typeof fallback === "function") {
    return fallback.bind(sinkObject);
  }
  return null;
}

/**
 * @param {{
 *  module?: string,
 *  runId?: string,
 *  sink?: unknown,
 *  redactSensitive?: boolean,
 *  levelResolver?: () => string
 * }} [options]
 */
export function createLogger(options = {}) {
  const moduleTag = String(options.module || DEFAULT_MODULE);
  const runId = String(options.runId || createRunId());
  const sink = options.sink || (typeof console !== "undefined" ? console : null);
  const redactSensitive = options.redactSensitive !== false;
  const resolveLevel = typeof options.levelResolver === "function" ? options.levelResolver : getGlobalLogLevel;

  /**
   * @param {"error"|"warn"|"info"|"debug"} method
   * @param {unknown[]} args
   */
  const emit = (method, args) => {
    const activeLevel = normalizeLogLevel(resolveLevel(), DEFAULT_LOG_LEVEL);
    if (!shouldEmit(method, activeLevel)) {
      return;
    }

    const sinkMethod = resolveSinkMethod(sink, method);
    if (!sinkMethod) {
      return;
    }

    const sanitizedArgs = args.map((arg, index) =>
      sanitizeValue(arg, 0, `arg_${index}`, redactSensitive)
    );
    sinkMethod(`[ccs][${method}][${moduleTag}][${runId}]`, ...sanitizedArgs);
  };

  return {
    module: moduleTag,
    runId,
    child(childTag) {
      const suffix = String(childTag || "").trim();
      return createLogger({
        module: suffix ? `${moduleTag}:${suffix}` : moduleTag,
        runId,
        sink,
        redactSensitive,
        levelResolver: resolveLevel
      });
    },
    withRun(nextRunId = createRunId()) {
      return createLogger({
        module: moduleTag,
        runId: nextRunId,
        sink,
        redactSensitive,
        levelResolver: resolveLevel
      });
    },
    error(...args) {
      emit("error", args);
    },
    warn(...args) {
      emit("warn", args);
    },
    info(...args) {
      emit("info", args);
    },
    debug(...args) {
      emit("debug", args);
    }
  };
}
