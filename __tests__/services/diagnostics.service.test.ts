import { Types } from "mongoose";

jest.mock("../../src/repositories/diagnosticSession.repository", () => ({
  diagnosticSessionRepository: {
    insertOne: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));
jest.mock("../../src/repositories/diagnosticChecklist.repository", () => ({
  diagnosticChecklistRepository: { findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));

import { diagnosticChecklistRepository } from "../../src/repositories/diagnosticChecklist.repository";
import { diagnosticSessionRepository } from "../../src/repositories/diagnosticSession.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import {
  listDiagnosticSessions,
  readDiagnosticSession,
  readChecklist,
  removeChecklistItem,
  saveDiagnosticSession,
  setChecklistItemDone,
  SaveDiagnosticSessionPayload,
} from "../../src/services/diagnostics/diagnostics.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const userId = new Types.ObjectId();

const requester: Requester = {
  userId,
  accountId,
  role: "owner",
  user: {} as any,
};

const vehicle = { _id: vehicleId, accountId } as VehicleDocument;

const noCodes = { supported: true, codes: [] };

const payload: SaveDiagnosticSessionPayload = {
  startedAt: "2026-08-30T15:06:01.405Z",
  deviceName: "OBDBLE",
  protocol: "ISO 14230-4 KWP (rápido)",
  voltage: 16.3,
  malfunctionLightOn: false,
  storedCodes: 0,
  troubleCodes: {
    confirmed: noCodes,
    pending: noCodes,
    permanent: { supported: false, codes: [] },
  },
  monitors: [{ name: "Catalisador", complete: true }],
  supportedPids: ["010C"],
  readings: [
    {
      command: "010C",
      label: "Rotação do motor",
      unit: "rpm",
      value: 872,
      text: null,
      answered: true,
      supported: true,
    },
  ],
  trip: [],
  sampleCount: 120,
  findings: [
    {
      code: "voltage-high",
      title: "Meça a bateria com multímetro",
      why: "16.3 V com o motor ligado",
      priority: "soon",
    },
  ],
};

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (diagnosticSessionRepository.insertOne as jest.Mock).mockImplementation(
    async (document: Record<string, unknown>) => ({
      toObject: () => ({ ...document, _id: new Types.ObjectId() }),
    }),
  );
  (diagnosticChecklistRepository.findOne as jest.Mock).mockResolvedValue(null);
  (diagnosticChecklistRepository.updateOne as jest.Mock).mockResolvedValue({});
});

describe("saveDiagnosticSession", () => {
  it("guarda a leitura e abre a pendência do achado", async () => {
    const result = await saveDiagnosticSession(
      requester,
      String(vehicleId),
      payload,
    );

    expect(result.session.deviceName).toBe("OBDBLE");
    expect(result.checklist.open).toHaveLength(1);
    expect(result.checklist.open[0].code).toBe("voltage-high");
    expect(diagnosticChecklistRepository.updateOne).toHaveBeenCalledWith(
      { accountId, vehicleId },
      expect.objectContaining({ $set: expect.any(Object) }),
      { upsert: true },
    );
  });

  it("não guarda o chassi junto da leitura", async () => {
    await saveDiagnosticSession(requester, String(vehicleId), payload);

    const saved = (diagnosticSessionRepository.insertOne as jest.Mock).mock
      .calls[0][0];

    expect(Object.keys(saved)).not.toContain("vin");
  });

  it("recusa data de leitura inválida", async () => {
    await expect(
      saveDiagnosticSession(requester, String(vehicleId), {
        ...payload,
        startedAt: "ontem",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("mantém validada a pendência que a leitura nova encontrou de novo", async () => {
    (diagnosticChecklistRepository.findOne as jest.Mock).mockResolvedValue({
      items: [
        {
          code: "voltage-high",
          title: "Meça a bateria com multímetro",
          why: "antigo",
          priority: "soon",
          createdAt: new Date("2026-08-01T10:00:00.000Z"),
          lastSeenAt: new Date("2026-08-01T10:00:00.000Z"),
          doneAt: new Date("2026-08-20T10:00:00.000Z"),
        },
      ],
    });

    const result = await saveDiagnosticSession(
      requester,
      String(vehicleId),
      payload,
    );

    expect(result.checklist.open).toHaveLength(0);
    expect(result.checklist.done).toHaveLength(1);
    expect(result.checklist.done[0].createdAt).toEqual(
      new Date("2026-08-01T10:00:00.000Z"),
    );
  });
});

describe("checklist", () => {
  beforeEach(() => {
    (diagnosticChecklistRepository.findOne as jest.Mock).mockResolvedValue({
      items: [
        {
          code: "odometer-manual",
          title: "Registre o hodômetro",
          why: "o carro não entrega",
          priority: "whenever",
          createdAt: new Date("2026-08-01T10:00:00.000Z"),
          lastSeenAt: new Date("2026-08-01T10:00:00.000Z"),
          doneAt: null,
        },
      ],
    });
  });

  it("separa aberto de validado na leitura da lista", async () => {
    const checklist = await readChecklist(requester, String(vehicleId));

    expect(checklist.open).toHaveLength(1);
    expect(checklist.done).toHaveLength(0);
  });

  it("marca a pendência como feita", async () => {
    const checklist = await setChecklistItemDone(
      requester,
      String(vehicleId),
      "odometer-manual",
      true,
    );

    expect(checklist.open).toHaveLength(0);
    expect(checklist.done[0].doneAt).toBeInstanceOf(Date);
  });

  it("apaga a pendência quando a pessoa manda tirar da lista", async () => {
    const checklist = await removeChecklistItem(
      requester,
      String(vehicleId),
      "odometer-manual",
    );

    expect(checklist.open).toHaveLength(0);
    expect(checklist.done).toHaveLength(0);
  });

  it("devolve 404 para código que não existe", async () => {
    await expect(
      setChecklistItemDone(requester, String(vehicleId), "inexistente", true),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      removeChecklistItem(requester, String(vehicleId), "inexistente"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("listDiagnosticSessions", () => {
  it("devolve o histórico mais recente primeiro", async () => {
    (diagnosticSessionRepository.find as jest.Mock).mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        startedAt: new Date("2026-08-30T15:06:01.405Z"),
        deviceName: "OBDBLE",
        troubleCodes: {
          confirmed: noCodes,
          pending: noCodes,
          permanent: { supported: false, codes: [] },
        },
      },
    ]);

    const result = await listDiagnosticSessions(requester, String(vehicleId), {
      limit: 5,
    });

    expect(result.sessions).toHaveLength(1);
    expect(diagnosticSessionRepository.find).toHaveBeenCalledWith(
      { vehicleId },
      null,
      { sort: { startedAt: -1 }, limit: 5 },
    );
  });
});

describe("readDiagnosticSession", () => {
  it("devolve a leitura guardada", async () => {
    const id = new Types.ObjectId();
    (diagnosticSessionRepository.findOne as jest.Mock).mockResolvedValue({
      _id: id,
      startedAt: new Date("2026-08-30T15:06:01.405Z"),
      deviceName: "OBDBLE",
      troubleCodes: {
        confirmed: noCodes,
        pending: noCodes,
        permanent: { supported: false, codes: [] },
      },
    });

    const session = await readDiagnosticSession(
      requester,
      String(vehicleId),
      String(id),
    );

    expect(session.id).toBe(String(id));
    expect(session.sampleCount).toBe(0);
  });

  it("devolve 404 quando a leitura não é daquele veículo", async () => {
    (diagnosticSessionRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      readDiagnosticSession(requester, String(vehicleId), "outra"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
