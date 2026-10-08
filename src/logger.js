/**
 * Simple logger utility matching standard SDK logging format.
 * Uses console.log/warn/error with timestamps and namespace.
 *
 * @param {string} name - Logger namespace
 * @returns {{ info: Function, warn: Function, error: Function, debug: Function }}
 */
export function createLogger(name) {
  const formatMessage = (level, message) => {
    const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");
    return `${timestamp} - ${level} - [${name}] ${message}`;
  };

  return {
    info: (message) => console.log(formatMessage("INFO", message)),
    warn: (message) => console.warn(formatMessage("WARNING", message)),
    error: (message) => console.error(formatMessage("ERROR", message)),
    debug: (message) => {
      if (typeof process !== "undefined" && process.env?.DEBUG) {
        console.log(formatMessage("DEBUG", message));
      }
    },
  };
}
