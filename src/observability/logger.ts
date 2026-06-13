import pino from 'pino';

export interface LoggerContext {
  logLevel: string;
}

export function createLogger(ctx: LoggerContext) {
  return pino({
    level: ctx.logLevel,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
