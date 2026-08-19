import { pushDeviceSchema } from "../models/pushDevice.model";
import { PushDeviceDocument } from "../types/notification";
import { createInstanceMongoose } from "./base";

export const pushDeviceRepository = createInstanceMongoose<PushDeviceDocument>(
  "pushDevices",
  pushDeviceSchema,
);
