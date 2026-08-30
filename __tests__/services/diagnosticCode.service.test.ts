jest.mock("../../src/repositories/diagnosticCode.repository", () => ({
  diagnosticCodeRepository: { findOne: jest.fn(), find: jest.fn() },
}));

import { diagnosticCodeRepository } from "../../src/repositories/diagnosticCode.repository";
import {
  readDiagnosticCode,
  readDiagnosticCodes,
} from "../../src/services/diagnostics/diagnosticCode.service";

const entry = {
  code: "P0300",
  title: "Falha de combustão",
  explanation: "explicação revisada",
  severity: "soon",
  drivable: true,
  likelyCauses: ["velas"],
  catalogItemCode: "SPARK_PLUGS",
  active: true,
};

describe("readDiagnosticCode", () => {
  it("devolve o verbete curado", async () => {
    (diagnosticCodeRepository.findOne as jest.Mock).mockResolvedValue(entry);

    const view = await readDiagnosticCode("p0300");

    expect(view.known).toBe(true);
    expect(view.severity).toBe("soon");
    expect(view.likelyCauses).toEqual(["velas"]);
  });

  it("não inventa significado para código de montadora", async () => {
    const view = await readDiagnosticCode("U3000");

    expect(view.manufacturerSpecific).toBe(true);
    expect(view.known).toBe(false);
    expect(view.severity).toBeNull();
    expect(diagnosticCodeRepository.findOne).not.toHaveBeenCalled();
  });

  it("assume a lacuna quando o código de norma ainda não foi curado", async () => {
    (diagnosticCodeRepository.findOne as jest.Mock).mockResolvedValue(null);

    const view = await readDiagnosticCode("P0abc".toUpperCase());

    expect(view.known).toBe(false);
    expect(view.manufacturerSpecific).toBe(false);
    expect(view.title).toContain("não catalogado");
  });

  it("recusa o que não é código", async () => {
    await expect(readDiagnosticCode("banana")).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("readDiagnosticCodes", () => {
  it("resolve a lista sem consultar o banco para código de montadora", async () => {
    (diagnosticCodeRepository.find as jest.Mock).mockResolvedValue([entry]);

    const views = await readDiagnosticCodes(["P0300", "U3000", "P0420"]);

    expect(views).toHaveLength(3);
    expect(views[0].known).toBe(true);
    expect(views[1].manufacturerSpecific).toBe(true);
    expect(views[2].known).toBe(false);
    expect(diagnosticCodeRepository.find).toHaveBeenCalledWith({
      code: { $in: ["P0300", "P0420"] },
      active: true,
    });
  });
});
