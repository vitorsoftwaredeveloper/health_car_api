import mongoose from "mongoose";
import { loadLocalEnv } from "../../scripts/localEnv";
import { db } from "../../src/libs/mongo";

const COLLECTIONS = [
  "accounts",
  "users",
  "vehicles",
  "planItems",
  "odometerReadings",
  "alerts",
  "maintenanceEvents",
  "attachments",
  "notifications",
  "pushDevices",
];

loadLocalEnv();
process.env.STAGE = "test";
process.env.DB = process.env.DB_TEST || process.env.DB;
delete process.env.NOTIFICATIONS_QUEUE_URL;

beforeEach(async () => {
  await db();
  const { db: database } = mongoose.connection;
  if (!database) throw new Error("banco de integração indisponível");

  await Promise.all(
    COLLECTIONS.map((name) => database.collection(name).deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});
