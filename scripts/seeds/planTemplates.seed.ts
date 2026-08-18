import mongoose from "mongoose";
import { ACTIVE_BY_DEFAULT_CRITICALITIES } from "../../src/domain/planItem";
import { catalogItemSchema } from "../../src/models/catalogItem.model";
import { planTemplateSchema } from "../../src/models/planTemplate.model";
import { CatalogItemDocument } from "../../src/types/catalog";
import { PlanTemplateDocument } from "../../src/types/plan-template";

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

  const catalogItems = await catalogModel.find({ active: true }).lean();

  if (!catalogItems.length) {
    throw new Error("Catálogo vazio. Rode npm run seed:catalog antes.");
  }

  const items = catalogItems.map((item) => ({
    catalogItemCode: item.code,
    intervalKm: item.defaultIntervalKm ?? null,
    intervalMonths: item.defaultIntervalMonths ?? null,
    activeByDefault: ACTIVE_BY_DEFAULT_CRITICALITIES.includes(item.criticality),
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
    ativosPorPadrao: items.filter((item) => item.activeByDefault).length,
  });

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("falha ao semear o template", error);
  process.exit(1);
});
