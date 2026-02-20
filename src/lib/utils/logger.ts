type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

const SHOULD_LOG_DEBUG = process.env.NODE_ENV !== "production";

function formatPayload(level: LogLevel, message: string, meta?: LogMeta): string {
  return JSON.stringify({
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  });
}

export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (!SHOULD_LOG_DEBUG) {
      return;
    }

    console.debug(formatPayload("debug", message, meta));
  },

  info(message: string, meta?: LogMeta) {
    console.info(formatPayload("info", message, meta));
  },

  warn(message: string, meta?: LogMeta) {
    console.warn(formatPayload("warn", message, meta));
  },

  error(message: string, meta?: LogMeta) {
    console.error(formatPayload("error", message, meta));
  },
};
