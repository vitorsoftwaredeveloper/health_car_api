import { alertSchema } from "../models/alert.model";
import { AlertDocument } from "../types/alert";
import { createInstanceMongoose } from "./base";

export const alertRepository = createInstanceMongoose<AlertDocument>(
  "alerts",
  alertSchema,
);
