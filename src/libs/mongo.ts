import mongoose, { ClientSession } from "mongoose";
import { describeError, log } from "./logger";
import { getSsmParameter } from "./ssm";

let connection: typeof mongoose | null = null;
let indexesSynced = false;

const resolveConnectionString = async (): Promise<string> => {
  const dbEnv = process.env.DB as string;

  if (dbEnv.startsWith("mongodb")) {
    return dbEnv;
  }

  return getSsmParameter(dbEnv);
};

const shouldSyncIndexes = (): boolean => process.env.SYNC_INDEXES === "true";

export const syncIndexes = async (conn: typeof mongoose): Promise<void> => {
  if (indexesSynced) return;
  indexesSynced = true;

  const models = Object.values(conn.models);
  for (const model of models) {
    try {
      await model.syncIndexes();
      log.info("db.indexes.synced", { model: model.modelName });
    } catch (err: any) {
      log.error("db.indexes.failed", {
        model: model.modelName,
        ...describeError(err),
      });
    }
  }
};

export const db = async (): Promise<typeof mongoose | undefined> => {
  try {
    if (connection) return connection;

    const connectionString = await resolveConnectionString();
    connection = await mongoose.connect(connectionString);
    log.info("db.connected");
    if (shouldSyncIndexes()) await syncIndexes(connection);
    return connection;
  } catch (err) {
    log.error("db.connection.failed", describeError(err));
    throw err;
  }
};

export const withTransaction = async <T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> => {
  const conn = await db();
  const session = await (conn as typeof mongoose).startSession();

  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
};
