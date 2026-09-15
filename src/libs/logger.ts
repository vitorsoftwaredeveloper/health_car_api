type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const requestContext: LogFields = {};

const configuredLevel = (): LogLevel => {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return raw in LEVEL_RANK ? (raw as LogLevel) : "info";
};

const shouldEmit = (level: LogLevel): boolean =>
  LEVEL_RANK[level] >= LEVEL_RANK[configuredLevel()];

const writerFor = (level: LogLevel) => {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  return console.log;
};

const emit = (level: LogLevel, event: string, fields: LogFields = {}): void => {
  if (!shouldEmit(level)) return;

  writerFor(level)(
    JSON.stringify({
      level,
      event,
      ...requestContext,
      ...fields,
    }),
  );
};

export const bindLogContext = (fields: LogFields): void => {
  Object.assign(requestContext, fields);
};

export const clearLogContext = (): void => {
  for (const key of Object.keys(requestContext)) delete requestContext[key];
};

export const describeError = (error: unknown): LogFields => {
  if (!(error instanceof Error)) return { message: String(error) };

  const enriched = error as Error & {
    code?: unknown;
    statusCode?: unknown;
    details?: unknown;
  };

  return {
    name: enriched.name,
    message: enriched.message,
    code: enriched.code,
    statusCode: enriched.statusCode,
    details: enriched.details,
    stack: enriched.stack,
  };
};

export const log = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
