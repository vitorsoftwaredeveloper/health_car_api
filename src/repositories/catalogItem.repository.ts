import { catalogItemSchema } from "../models/catalogItem.model";
import { CatalogItemDocument } from "../types/catalog";
import { createInstanceMongoose } from "./base";

export const catalogItemRepository = createInstanceMongoose<CatalogItemDocument>(
  "catalogItems",
  catalogItemSchema,
);
