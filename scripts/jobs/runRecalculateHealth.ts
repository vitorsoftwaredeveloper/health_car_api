import mongoose from "mongoose";
import { runRecalculateHealth } from "../../src/services/jobs/recalculateHealth.service";

const LOCAL_CONNECTION =
  "mongodb://localhost:27017/health_car?replicaSet=rs0";

const run = async (): Promise<void> => {
  process.env.DB = process.env.DB || LOCAL_CONNECTION;
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  console.log("resultado", await runRecalculateHealth());
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("job falhou", error);
  process.exit(1);
});
