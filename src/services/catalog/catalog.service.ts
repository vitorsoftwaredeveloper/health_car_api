import { Types } from "mongoose";
import { catalogItemRepository } from "../../repositories/catalogItem.repository";
import {
  CatalogAppliesTo,
  CatalogItemDocument,
  Category,
} from "../../types/catalog";
import { Criticality, DueType } from "../../types/plan";
import {
  DUPLICATE_KEY_ERROR_CODE,
  httpError,
  STATUS_CODE,
} from "../../utils/errors";

export interface CatalogItemPayload {
  code: string;
  name: string;
  category: Category;
  dueType: DueType;
  defaultIntervalKm?: number | null;
  defaultIntervalMonths?: number | null;
  criticality: Criticality;
  whatItIs: string;
  whyItMatters: string;
  appliesTo?: CatalogAppliesTo | null;
  bundledWith?: string[];
  active?: boolean;
}

export interface ListCatalogItemsQuery {
  category?: Category;
  includeInactive?: boolean;
}

export interface CatalogItemView {
  id: string;
  code: string;
  name: string;
  category: Category;
  dueType: DueType;
  defaultIntervalKm: number | null;
  defaultIntervalMonths: number | null;
  criticality: Criticality;
  whatItIs: string;
  whyItMatters: string;
  appliesTo: CatalogAppliesTo | null;
  bundledWith: string[];
  active: boolean;
}

export const toCatalogItemView = (
  item: CatalogItemDocument,
): CatalogItemView => ({
  id: String(item._id),
  code: item.code,
  name: item.name,
  category: item.category,
  dueType: item.dueType,
  defaultIntervalKm: item.defaultIntervalKm ?? null,
  defaultIntervalMonths: item.defaultIntervalMonths ?? null,
  criticality: item.criticality,
  whatItIs: item.whatItIs,
  whyItMatters: item.whyItMatters,
  appliesTo: item.appliesTo ?? null,
  bundledWith: item.bundledWith ?? [],
  active: item.active,
});

const assertIntervalMatchesDueType = (payload: CatalogItemPayload): void => {
  const needsKm = payload.dueType === "km" || payload.dueType === "both";
  const needsMonths = payload.dueType === "time" || payload.dueType === "both";

  if (needsKm && !payload.defaultIntervalKm) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INTERVAL_KM_REQUIRED",
      "Item que vence por quilometragem precisa de intervalo em km.",
    );
  }

  if (needsMonths && !payload.defaultIntervalMonths) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INTERVAL_MONTHS_REQUIRED",
      "Item que vence por tempo precisa de intervalo em meses.",
    );
  }

  if (
    payload.dueType === "inspection" &&
    !payload.defaultIntervalKm &&
    !payload.defaultIntervalMonths
  ) {
    throw httpError(
      STATUS_CODE.UNPROCESSABLE_ENTITY,
      "INSPECTION_INTERVAL_REQUIRED",
      "Item de inspeção precisa de um intervalo de verificação.",
    );
  }
};

const duplicateCode = () =>
  httpError(
    STATUS_CODE.CONFLICT,
    "CATALOG_CODE_ALREADY_EXISTS",
    "Já existe um item de catálogo com este código.",
  );

export const listCatalogItems = async (
  query: ListCatalogItemsQuery,
): Promise<CatalogItemView[]> => {
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (!query.includeInactive) filter.active = true;

  const items = (await catalogItemRepository.find(filter, null, {
    sort: { category: 1, name: 1 },
  })) as CatalogItemDocument[];

  return items.map(toCatalogItemView);
};

export const createCatalogItem = async (
  payload: CatalogItemPayload,
): Promise<CatalogItemView> => {
  assertIntervalMatchesDueType(payload);

  try {
    const created = await catalogItemRepository.insertOne({
      ...payload,
      code: payload.code.trim().toUpperCase(),
      active: payload.active ?? true,
    });
    return toCatalogItemView(created.toObject() as CatalogItemDocument);
  } catch (error: any) {
    if (error?.code === DUPLICATE_KEY_ERROR_CODE) throw duplicateCode();
    throw error;
  }
};

export const updateCatalogItem = async (
  catalogItemId: string,
  payload: CatalogItemPayload,
): Promise<CatalogItemView> => {
  assertIntervalMatchesDueType(payload);

  if (!Types.ObjectId.isValid(catalogItemId)) {
    throw httpError(
      STATUS_CODE.NOT_FOUND,
      "CATALOG_ITEM_NOT_FOUND",
      "Item de catálogo não encontrado.",
    );
  }

  try {
    const updated = (await catalogItemRepository.findOneAndUpdate(
      { _id: new Types.ObjectId(catalogItemId) },
      {
        $set: {
          ...payload,
          code: payload.code.trim().toUpperCase(),
          active: payload.active ?? true,
        },
      },
    )) as unknown as CatalogItemDocument | null;

    if (!updated) {
      throw httpError(
        STATUS_CODE.NOT_FOUND,
        "CATALOG_ITEM_NOT_FOUND",
        "Item de catálogo não encontrado.",
      );
    }

    return toCatalogItemView(updated);
  } catch (error: any) {
    if (error?.code === DUPLICATE_KEY_ERROR_CODE) throw duplicateCode();
    throw error;
  }
};
