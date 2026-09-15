import { fuelEntrySchema } from "../models/fuelEntry.model";
import { FuelEntryDocument } from "../types/fuel";
import { createInstanceMongoose } from "./base";

export const fuelEntryRepository = createInstanceMongoose<FuelEntryDocument>(
  "fuelEntries",
  fuelEntrySchema,
);
