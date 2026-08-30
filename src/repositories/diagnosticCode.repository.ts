import { diagnosticCodeSchema } from "../models/diagnosticCode.model";
import { DiagnosticCodeDocument } from "../types/diagnostics";
import { createInstanceMongoose } from "./base";

export const diagnosticCodeRepository =
  createInstanceMongoose<DiagnosticCodeDocument>(
    "diagnosticCodeCatalog",
    diagnosticCodeSchema,
  );
