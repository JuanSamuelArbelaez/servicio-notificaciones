// ./src/lib/logger.js
function log(level, logger, message, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(), // RFC3339-ish
    level,
    logger,
    message,
    thread: process.pid.toString(),
    ...meta,
  };
  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (loggerName, message, meta) => log("info", loggerName, message, meta),
  debug: (loggerName, message, meta) => log("debug", loggerName, message, meta),
  warn: (loggerName, message, meta) => log("warn", loggerName, message, meta),
  error: (loggerName, message, meta) => log("error", loggerName, message, meta),
};
