import { diagnosticChecklistSchema } from "../models/diagnosticChecklist.model";
import { DiagnosticChecklistDocument } from "../types/diagnostics";
import { createInstanceMongoose } from "./base";

export const diagnosticChecklistRepository =
  createInstanceMongoose<DiagnosticChecklistDocument>(
    "diagnosticChecklists",
    diagnosticChecklistSchema,
  );
