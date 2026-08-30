import { diagnosticSessionSchema } from "../models/diagnosticSession.model";
import { DiagnosticSessionDocument } from "../types/diagnostics";
import { createInstanceMongoose } from "./base";

export const diagnosticSessionRepository =
  createInstanceMongoose<DiagnosticSessionDocument>(
    "diagnosticSessions",
    diagnosticSessionSchema,
  );
