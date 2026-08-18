import mongoose from "mongoose";
import { catalogItemSchema } from "../../src/models/catalogItem.model";
import { CatalogItemDocument } from "../../src/types/catalog";
import { catalogItemsSeed } from "./catalogItems.data";

const LOCAL_CONNECTION =
  "mongodb://localhost:27017/health_car?replicaSet=rs0";

const run = async (): Promise<void> => {
  const connectionString = process.env.DB || LOCAL_CONNECTION;
  await mongoose.connect(connectionString);

  const model = mongoose.model<CatalogItemDocument>(
    "catalogItems",
    catalogItemSchema,
  );
  await model.syncIndexes();

  const result = await model.bulkWrite(
    catalogItemsSeed.map((item) => ({
      updateOne: {
        filter: { code: item.code },
        update: { $set: item },
        upsert: true,
      },
    })),
  );

  const seededCodes = catalogItemsSeed.map((item) => item.code);
  const obsolete = await model
    .find({ code: { $nin: seededCodes } }, { code: 1 })
    .lean();

  console.log("catálogo semeado", {
    total: catalogItemsSeed.length,
    inseridos: result.upsertedCount,
    atualizados: result.modifiedCount,
    foraDoSeed: obsolete.map((item) => item.code),
  });

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("falha ao semear o catálogo", error);
  process.exit(1);
});
