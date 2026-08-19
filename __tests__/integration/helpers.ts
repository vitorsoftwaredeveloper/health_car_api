import mongoose, { Types } from "mongoose";
import { catalogItemsSeed } from "../../scripts/seeds/catalogItems.data";
import { ACTIVE_BY_DEFAULT_CRITICALITIES } from "../../src/domain/planItem";
import { catalogItemRepository } from "../../src/repositories/catalogItem.repository";
import { planTemplateRepository } from "../../src/repositories/planTemplate.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { resolveRequester } from "../../src/services/users/requester.service";
import { AuthClaims } from "../../src/types/auth";
import { PlanItemDocument } from "../../src/types/plan-item";
import { Requester } from "../../src/types/user";
import { CreateVehiclePayload } from "../../src/services/vehicles/vehicle.service";

export const ownerClaims = (suffix: string): AuthClaims => ({
  sub: `integration-${suffix}`,
  email: `${suffix}@integration.test`,
  groups: ["owner"],
  role: "owner",
});

export const seedCatalogAndTemplate = async (): Promise<void> => {
  const existing = await catalogItemRepository.count({});
  if (existing === catalogItemsSeed.length) return;

  await catalogItemRepository.model.deleteMany({});
  await catalogItemRepository.model.insertMany(catalogItemsSeed);

  await planTemplateRepository.model.deleteMany({});
  await planTemplateRepository.model.create({
    name: "Genérico",
    criteria: {},
    priority: 0,
    active: true,
    items: catalogItemsSeed.map((item) => ({
      catalogItemCode: item.code,
      intervalKm: item.defaultIntervalKm ?? null,
      intervalMonths: item.defaultIntervalMonths ?? null,
      activeByDefault: ACTIVE_BY_DEFAULT_CRITICALITIES.includes(item.criticality),
    })),
  });
};

export const givenOwner = async (suffix: string): Promise<Requester> =>
  resolveRequester(ownerClaims(suffix));

export const vehiclePayload = (
  overrides: Partial<CreateVehiclePayload> = {},
): CreateVehiclePayload => ({
  nickname: "Meu Civic",
  make: "Honda",
  model: "Civic",
  manufactureYear: 2019,
  modelYear: 2020,
  fuel: "flex",
  transmission: "cvt",
  plate: "BRA2E19",
  currentOdometer: 78000,
  currentOdometerAt: "2026-08-01",
  ...overrides,
});

export const findPlanItem = async (
  vehicleId: Types.ObjectId | string,
  code: string,
): Promise<PlanItemDocument> => {
  const item = (await planItemRepository.findOne({
    vehicleId: new Types.ObjectId(String(vehicleId)),
    code,
  })) as PlanItemDocument | null;

  if (!item) throw new Error(`item ${code} não encontrado no plano`);
  return item;
};

export const setLastService = async (
  planItemId: Types.ObjectId | string,
  values: { lastServiceKm?: number | null; lastServiceDate?: Date | null },
): Promise<void> => {
  await planItemRepository.updateOne(
    { _id: new Types.ObjectId(String(planItemId)) },
    { $set: values },
  );
};

export const countIn = async (collection: string, filter: object = {}): Promise<number> =>
  (await mongoose.connection.db?.collection(collection).countDocuments(filter)) ?? 0;
