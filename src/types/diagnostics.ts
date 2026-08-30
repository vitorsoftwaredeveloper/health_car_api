import { Types } from "mongoose";

export type ChecklistPriority = "now" | "soon" | "whenever";

export interface DiagnosticTroubleCodes {
  supported: boolean;
  codes: string[];
}

export interface DiagnosticMonitor {
  name: string;
  complete: boolean;
}

export interface DiagnosticReading {
  command: string;
  label: string;
  unit: string;
  value: number | null;
  text: string | null;
  answered: boolean;
  supported: boolean;
}

export interface DiagnosticTripSummary {
  command: string;
  label: string;
  unit: string;
  minimum: number;
  average: number;
  maximum: number;
  samples: number;
}

export interface DiagnosticSessionDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  startedAt: Date;
  deviceName: string;
  adapterIdentity: string | null;
  protocol: string | null;
  voltage: number | null;
  malfunctionLightOn: boolean | null;
  storedCodes: number | null;
  troubleCodes: {
    confirmed: DiagnosticTroubleCodes;
    pending: DiagnosticTroubleCodes;
    permanent: DiagnosticTroubleCodes;
  };
  monitors: DiagnosticMonitor[];
  supportedPids: string[];
  readings: DiagnosticReading[];
  trip: DiagnosticTripSummary[];
  sampleCount: number;
  createdBy: Types.ObjectId;
  createdAt?: Date;
}

export interface ChecklistItem {
  code: string;
  title: string;
  why: string;
  priority: ChecklistPriority;
  createdAt: Date;
  lastSeenAt: Date;
  doneAt: Date | null;
}

export interface DiagnosticChecklistDocument {
  _id?: Types.ObjectId;
  accountId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  items: ChecklistItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChecklistFinding {
  code: string;
  title: string;
  why: string;
  priority: ChecklistPriority;
}
