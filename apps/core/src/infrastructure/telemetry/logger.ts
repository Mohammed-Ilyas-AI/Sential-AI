import { pino, type Logger } from 'pino';

export type { Logger };

/** Structured JSON logs; `severity` is what Cloud Logging reads. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    messageKey: 'message',
    formatters: { level: (label) => ({ severity: label.toUpperCase() }) },
  });
}
