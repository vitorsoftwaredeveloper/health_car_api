import {
  isGenericCode,
  isManufacturerCode,
  isValidCode,
  normalizeCode,
} from "../../domain/diagnosticCodes";
import { diagnosticCodeRepository } from "../../repositories/diagnosticCode.repository";
import {
  DiagnosticCodeDocument,
  DiagnosticSeverity,
} from "../../types/diagnostics";
import { httpError, STATUS_CODE } from "../../utils/errors";

export interface DiagnosticCodeView {
  code: string;
  known: boolean;
  manufacturerSpecific: boolean;
  title: string;
  explanation: string;
  severity: DiagnosticSeverity | null;
  drivable: boolean | null;
  likelyCauses: string[];
  catalogItemCode: string | null;
}

const MANUFACTURER_VIEW = (code: string): DiagnosticCodeView => ({
  code,
  known: false,
  manufacturerSpecific: true,
  title: "Código específico da montadora",
  explanation:
    "Este código não existe na norma: cada fabricante usa a mesma numeração para coisas diferentes. Leve o código à oficina em vez de procurar significado na internet, porque o que você achar provavelmente é de outra marca.",
  severity: null,
  drivable: null,
  likelyCauses: [],
  catalogItemCode: null,
});

const UNKNOWN_VIEW = (code: string): DiagnosticCodeView => ({
  code,
  known: false,
  manufacturerSpecific: false,
  title: "Código ainda não catalogado",
  explanation:
    "É um código de norma, mas ainda não passou pela nossa revisão. Ele entra na fila de curadoria. Até lá, leve o código à oficina.",
  severity: null,
  drivable: null,
  likelyCauses: [],
  catalogItemCode: null,
});

const toView = (entry: DiagnosticCodeDocument): DiagnosticCodeView => ({
  code: entry.code,
  known: true,
  manufacturerSpecific: false,
  title: entry.title,
  explanation: entry.explanation,
  severity: entry.severity,
  drivable: entry.drivable,
  likelyCauses: entry.likelyCauses ?? [],
  catalogItemCode: entry.catalogItemCode ?? null,
});

export const readDiagnosticCode = async (
  rawCode: string,
): Promise<DiagnosticCodeView> => {
  const code = normalizeCode(rawCode);

  if (!isValidCode(code)) {
    throw httpError(
      STATUS_CODE.BAD_REQUEST,
      "CODIGO_INVALIDO",
      "Esse código não tem o formato de uma falha OBD-II.",
    );
  }

  if (isManufacturerCode(code)) return MANUFACTURER_VIEW(code);

  const entry = (await diagnosticCodeRepository.findOne({
    code,
    active: true,
  })) as DiagnosticCodeDocument | null;

  if (!entry) return UNKNOWN_VIEW(code);

  return toView(entry);
};

export const readDiagnosticCodes = async (
  rawCodes: string[],
): Promise<DiagnosticCodeView[]> => {
  const codes = rawCodes.map(normalizeCode).filter(isValidCode).slice(0, 20);
  const generic = codes.filter(isGenericCode);

  const entries = (await diagnosticCodeRepository.find({
    code: { $in: generic },
    active: true,
  })) as DiagnosticCodeDocument[];

  return codes.map((code) => {
    if (isManufacturerCode(code)) return MANUFACTURER_VIEW(code);
    const entry = entries.find((item) => item.code === code);
    return entry ? toView(entry) : UNKNOWN_VIEW(code);
  });
};
