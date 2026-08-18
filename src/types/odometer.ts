import { Types } from "mongoose";

export type OdometerSource = "manual" | "service" | "refuel" | "correction";

export interface OdometerReadingDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  km: number;
  date: Date;
  source: OdometerSource;
  referenceId?: Types.ObjectId | null;
  correctsId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt?: Date;
}
