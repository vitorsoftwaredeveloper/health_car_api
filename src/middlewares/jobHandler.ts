import { clearLogContext, bindLogContext, describeError, log } from "../libs/logger";

export const withJobLogging =
  <TEvent, TResult>(
    job: string,
    run: (event: TEvent) => Promise<TResult>,
  ) =>
  async (event: TEvent): Promise<void> => {
    const startedAt = Date.now();
    clearLogContext();
    bindLogContext({ job });
    log.info("job.started");

    try {
      const result = await run(event);
      log.info("job.finished", {
        durationMs: Date.now() - startedAt,
        result,
      });
    } catch (error) {
      log.error("job.failed", {
        durationMs: Date.now() - startedAt,
        ...describeError(error),
      });
      throw error;
    } finally {
      clearLogContext();
    }
  };
