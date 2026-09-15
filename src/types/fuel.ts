import { Types } from "mongoose";

export type FuelKind = "gasoline" | "ethanol" | "diesel" | "cng";

export interface FuelEntryDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  date: Date;
  odometerKm: number;
  liters: number;
  fuelKind: FuelKind;
  totalCents: number | null;
  fullTank: boolean;
  odometerReadingId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt?: Date;
}
