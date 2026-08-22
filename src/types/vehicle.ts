import { Types } from "mongoose";

export type Fuel =
  | "flex"
  | "gasoline"
  | "ethanol"
  | "diesel"
  | "cng"
  | "hybrid"
  | "electric";

export type Transmission = "manual" | "automatic" | "cvt" | "automated";

export type VehicleStatus = "active" | "sold" | "archived";

export interface VehicleDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  nickname: string;
  make: string;
  model: string;
  trim?: string | null;
  manufactureYear: number;
  modelYear: number;
  engine?: string | null;
  fuel: Fuel;
  transmission?: Transmission | null;
  plate: string;
  plateHash: string;
  vin?: string | null;
  color?: string | null;
  photoKey?: string | null;
  currentOdometer: number;
  currentOdometerAt: Date;
  kmPerDay: number;
  healthScore: number;
  status: VehicleStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
