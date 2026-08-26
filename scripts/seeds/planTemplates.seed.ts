import mongoose from "mongoose";
import { catalogItemSchema } from "../../src/models/catalogItem.model";
import { planTemplateSchema } from "../../src/models/planTemplate.model";
import { CatalogItemDocument } from "../../src/types/catalog";
import { PlanTemplateDocument } from "../../src/types/plan-template";
import { COMMON_TO_EVERY_VEHICLE } from "./commonPlanItems";

const LOCAL_CONNECTION =
  "mongodb://localhost:27017/health_car?replicaSet=rs0";

const GENERIC_TEMPLATE_NAME = "Genérico";

const run = async (): Promise<void> => {
  await mongoose.connect(process.env.DB || LOCAL_CONNECTION);

  const catalogModel = mongoose.model<CatalogItemDocument>(
    "catalogItems",
    catalogItemSchema,
  );
  const templateModel = mongoose.model<PlanTemplateDocument>(
    "planTemplates",
    planTemplateSchema,
  );
  await templateModel.syncIndexes();

  const catalogItems = await catalogModel
    .find({ active: true, code: { $in: COMMON_TO_EVERY_VEHICLE } })
    .lean();

  if (!catalogItems.length) {
    throw new Error("Catálogo vazio. Rode npm run seed:catalog antes.");
  }

  const found = new Set(catalogItems.map((item) => item.code));
  const missing = COMMON_TO_EVERY_VEHICLE.filter((code) => !found.has(code));

  if (missing.length) {
    throw new Error(`Códigos ausentes no catálogo: ${missing.join(", ")}`);
  }

  const items = catalogItems.map((item) => ({
    catalogItemCode: item.code,
    intervalKm: item.defaultIntervalKm ?? null,
    intervalMonths: item.defaultIntervalMonths ?? null,
    activeByDefault: true,
  }));

  await templateModel.updateOne(
    { name: GENERIC_TEMPLATE_NAME },
    {
      $set: {
        name: GENERIC_TEMPLATE_NAME,
        criteria: {},
        items,
        priority: 0,
        active: true,
      },
    },
    { upsert: true },
  );

  console.log("template semeado", {
    nome: GENERIC_TEMPLATE_NAME,
    itens: items.length,
    observacao: "o que não é comum a todo carro fica no catálogo",
  });

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("falha ao semear o template", error);
  process.exit(1);
});
