import { vehicleSchema } from "../models/vehicle.model";
import { VehicleDocument } from "../types/vehicle";
import { createInstanceMongoose } from "./base";

export const vehicleRepository = createInstanceMongoose<VehicleDocument>(
  "vehicles",
  vehicleSchema,
);
