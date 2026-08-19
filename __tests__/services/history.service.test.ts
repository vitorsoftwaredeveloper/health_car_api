import { Types } from "mongoose";

jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: { find: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { find: jest.fn(), insertOne: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/libs/s3", () => ({
  createDownloadUrl: jest.fn(async (key: string) => `https://s3/${key}?signed`),
  createUploadUrl: jest.fn(async (key: string) => `https://s3/${key}?upload`),
  buildAttachmentKey: jest.fn(
    (accountId: string, vehicleId: string, attachmentId: string, ext: string) =>
      `accounts/${accountId}/vehicles/${vehicleId}/${attachmentId}.${ext}`,
  ),
}));

import { maintenanceEventRepository } from "../../src/repositories/maintenanceEvent.repository";
import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import {
  getMaintenanceEvent,
  listMaintenanceEvents,
} from "../../src/services/maintenance/history.service";
import { createAttachmentUpload } from "../../src/services/maintenance/attachment.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const eventId = new Types.ObjectId();

const requester: Requester = {
  userId: new Types.ObjectId(),
  accountId,
  role: "owner",
  user: {} as any,
};
const vehicle = { _id: vehicleId, accountId } as VehicleDocument;

const event = (overrides: any = {}) => ({
  _id: eventId,
  vehicleId,
  date: new Date("2026-08-15T03:00:00.000Z"),
  km: 78900,
  type: "preventive",
  items: [],
  attachments: [],
  totalCents: 71000,
  source: "manual",
  ...overrides,
});

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (maintenanceEventRepository.find as jest.Mock).mockResolvedValue([event()]);
  (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(event());
  (attachmentRepository.find as jest.Mock).mockResolvedValue([]);
  (attachmentRepository.insertOne as jest.Mock).mockResolvedValue({});
});

describe("listMaintenanceEvents", () => {
  it("ordena do mais novo e soma o total da página", async () => {
    const result = await listMaintenanceEvents(requester, String(vehicleId), {});

    expect((maintenanceEventRepository.find as jest.Mock).mock.calls[0][2]).toEqual({
      sort: { date: -1, createdAt: -1 },
      limit: 21,
    });
    expect(result.totalCentsInPage).toBe(71000);
    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "read");
  });

  it("filtra por ano e por tipo", async () => {
    await listMaintenanceEvents(requester, String(vehicleId), {
      year: 2026,
      type: "corrective",
    });

    expect((maintenanceEventRepository.find as jest.Mock).mock.calls[0][0]).toEqual({
      vehicleId,
      type: "corrective",
      date: {
        $gte: new Date(Date.UTC(2026, 0, 1)),
        $lt: new Date(Date.UTC(2027, 0, 1)),
      },
    });
  });

  it("combina o cursor com o filtro de ano", async () => {
    await listMaintenanceEvents(requester, String(vehicleId), {
      year: 2026,
      before: "2026-08-15T03:00:00.000Z",
    });

    const filter = (maintenanceEventRepository.find as jest.Mock).mock.calls[0][0];
    expect(filter.date).toEqual({
      $gte: new Date(Date.UTC(2026, 0, 1)),
      $lt: new Date("2026-08-15T03:00:00.000Z"),
    });
  });

  it("devolve cursor quando há mais páginas", async () => {
    (maintenanceEventRepository.find as jest.Mock).mockResolvedValue([
      event(),
      event({ date: new Date("2026-05-02T03:00:00.000Z") }),
    ]);

    const result = await listMaintenanceEvents(requester, String(vehicleId), { limit: 1 });

    expect(result.events).toHaveLength(1);
    expect(result.nextCursor).toBe("2026-08-15T03:00:00.000Z");
  });
});

describe("getMaintenanceEvent", () => {
  it("assina a URL de leitura de cada anexo", async () => {
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      { _id: new Types.ObjectId(), fileName: "nota.pdf", s3Key: "accounts/a/nota.pdf" },
    ]);

    const detail = await getMaintenanceEvent(requester, String(vehicleId), String(eventId));

    expect(detail.attachmentUrls[0]).toMatchObject({
      fileName: "nota.pdf",
      url: "https://s3/accounts/a/nota.pdf?signed",
    });
  });

  it("recusa evento inexistente", async () => {
    (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      getMaintenanceEvent(requester, String(vehicleId), String(eventId)),
    ).rejects.toMatchObject({ statusCode: 404, code: "MAINTENANCE_EVENT_NOT_FOUND" });
  });

  it("recusa id malformado", async () => {
    await expect(
      getMaintenanceEvent(requester, String(vehicleId), "nao-e-id"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("createAttachmentUpload", () => {
  it("gera chave escopada por conta e veículo e devolve URL assinada", async () => {
    const result = await createAttachmentUpload(requester, String(vehicleId), {
      fileName: "nota fiscal.pdf",
      mimeType: "application/pdf",
      sizeBytes: 120000,
    });

    expect(result.s3Key).toBe(
      `accounts/${accountId}/vehicles/${vehicleId}/${result.attachmentId}.pdf`,
    );
    expect(result.uploadUrl).toContain("?upload");
    expect(result.expiresInSeconds).toBe(300);

    const document = (attachmentRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.type).toBe("receipt");
    expect(document.link).toBeNull();
    expect(document.fileName).toBe("nota fiscal.pdf");
  });

  it("recusa tipo de arquivo fora da lista", async () => {
    await expect(
      createAttachmentUpload(requester, String(vehicleId), {
        fileName: "planilha.xlsx",
        mimeType: "application/vnd.ms-excel",
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("recusa arquivo acima de 10 MB", async () => {
    await expect(
      createAttachmentUpload(requester, String(vehicleId), {
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "FILE_TOO_LARGE" });
  });

  it("exige acesso de escrita", async () => {
    await createAttachmentUpload(requester, String(vehicleId), {
      fileName: "nota.jpg",
      mimeType: "image/jpeg",
    });

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "write");
  });
});
