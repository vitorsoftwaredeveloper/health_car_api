import mongoose from "mongoose";
import { loadLocalEnv } from "../localEnv";
import { runRecalculateHealth } from "../../src/services/jobs/recalculateHealth.service";

const run = async (): Promise<void> => {
  loadLocalEnv();

  console.log("resultado", await runRecalculateHealth());
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("job falhou", error);
  process.exit(1);
});
