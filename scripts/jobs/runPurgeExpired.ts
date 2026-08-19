import mongoose from "mongoose";
import { loadLocalEnv } from "../localEnv";
import { runPurgeExpired } from "../../src/services/purge/purge.service";

const run = async (): Promise<void> => {
  loadLocalEnv();

  console.log("resultado", await runPurgeExpired());
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("job falhou", error);
  process.exit(1);
});
