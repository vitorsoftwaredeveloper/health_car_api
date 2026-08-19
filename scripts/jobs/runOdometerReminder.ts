import mongoose from "mongoose";
import { loadLocalEnv } from "../localEnv";
import { runOdometerReminder } from "../../src/services/jobs/odometerReminder.service";

const run = async (): Promise<void> => {
  loadLocalEnv();

  console.log("resultado", await runOdometerReminder());
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("job falhou", error);
  process.exit(1);
});
