import mongoose from "mongoose";
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

const syncIndexes = async (conn: typeof mongoose): Promise<void> => {
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
    await syncIndexes(connection);
    return connection;
  } catch (err) {
    console.log("connection database error", err);
    throw err;
  }
};
