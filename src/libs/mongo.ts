import mongoose, { ClientSession } from "mongoose";
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
      console.log("indexes synced", { model: model.modelName });
    } catch (err: any) {
      console.error("index sync failed", {
        model: model.modelName,
        message: err?.message,
        code: err?.code,
      });
    }
  }
};

export const db = async (): Promise<typeof mongoose | undefined> => {
  try {
    if (connection) {
      console.log("db connection reused");
      return connection;
    }

    const connectionString = await resolveConnectionString();
    connection = await mongoose.connect(connectionString);
    console.log("connection database successful");
    if (shouldSyncIndexes()) await syncIndexes(connection);
    return connection;
  } catch (err) {
    console.log("connection database error", err);
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
