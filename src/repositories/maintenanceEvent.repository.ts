import { maintenanceEventSchema } from "../models/maintenanceEvent.model";
import { MaintenanceEventDocument } from "../types/maintenance";
import { createInstanceMongoose } from "./base";

export const maintenanceEventRepository =
  createInstanceMongoose<MaintenanceEventDocument>(
    "maintenanceEvents",
    maintenanceEventSchema,
  );
