import { odometerReadingSchema } from "../models/odometerReading.model";
import { OdometerReadingDocument } from "../types/odometer";
import { createInstanceMongoose } from "./base";

export const odometerReadingRepository =
  createInstanceMongoose<OdometerReadingDocument>(
    "odometerReadings",
    odometerReadingSchema,
  );
