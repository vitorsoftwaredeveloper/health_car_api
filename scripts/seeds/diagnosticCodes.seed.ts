import mongoose from "mongoose";
import { diagnosticCodeSchema } from "../../src/models/diagnosticCode.model";
import { DiagnosticCodeDocument } from "../../src/types/diagnostics";
import { diagnosticCodesSeed } from "./diagnosticCodes.data";

const LOCAL_CONNECTION = "mongodb://localhost:27017/health_car?replicaSet=rs0";

const run = async (): Promise<void> => {
  const connectionString = process.env.DB || LOCAL_CONNECTION;
  await mongoose.connect(connectionString);

  const model = mongoose.model<DiagnosticCodeDocument>(
    "diagnosticCodeCatalog",
    diagnosticCodeSchema,
  );
  await model.syncIndexes();

  const result = await model.bulkWrite(
    diagnosticCodesSeed.map((entry) => ({
      updateOne: {
        filter: { code: entry.code },
        update: { $set: entry },
        upsert: true,
      },
    })),
  );

  console.log(
    `dicionário de falhas: ${result.upsertedCount} novo(s), ${result.modifiedCount} atualizado(s)`,
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
