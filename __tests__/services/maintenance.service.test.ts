import { Types } from "mongoose";

jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: { insertOne: jest.fn() },
}));
jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { find: jest.fn(), insertOne: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { updateMany: jest.fn() },
}));
jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { find: jest.fn(), updateMany: jest.fn() },
}));
jest.mock("../../src/services/vehicles/access.service", () => ({
  assertVehicleAccess: jest.fn(),
}));
jest.mock("../../src/services/plan/recalculate.service", () => ({
  recalculateVehicle: jest.fn(),
}));

import { maintenanceEventRepository } from "../../src/repositories/maintenanceEvent.repository";
import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { alertRepository } from "../../src/repositories/alert.repository";
import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import { recalculateVehicle } from "../../src/services/plan/recalculate.service";
import { registerMaintenanceEvent } from "../../src/services/maintenance/maintenance.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";
import { parseLocalDate } from "../../src/utils/date";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const userId = new Types.ObjectId();
const oilItemId = new Types.ObjectId();
const filterItemId = new Types.ObjectId();

const requester: Requester = { userId, accountId, role: "owner", user: {} as any };
const vehicle = { _id: vehicleId, accountId } as VehicleDocument;

const oilItem = {
  _id: oilItemId,
  vehicleId,
  code: "ENGINE_OIL",
  name: "Óleo do motor + filtro",
  status: "overdue",
  cycle: 3,
};
const filterItem = {
  _id: filterItemId,
  vehicleId,
  code: "CABIN_FILTER",
  name: "Filtro de cabine",
  status: "due_soon",
  cycle: 0,
};

const payload = {
  date: "2026-08-15",
  km: 78900,
  type: "preventive" as const,
  workshop: { name: "Auto Center Nakata", city: "Fortaleza" },
  items: [
    {
      planItemId: String(oilItemId),
      action: "replace" as const,
      description: "Óleo 5W30 sintético + filtro",
      partBrand: "Mobil",
      partCents: 32000,
    },
    {
      planItemId: String(filterItemId),
      action: "replace" as const,
      description: "Filtro de cabine",
      partCents: 9000,
    },
    {
      action: "repair" as const,
      description: "Reparo do vidro elétrico dianteiro",
      partCents: 18000,
    },
  ],
  laborCents: 12000,
};

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (odometerReadingRepository.find as jest.Mock).mockResolvedValue([{ km: 78000 }]);
  (planItemRepository.find as jest.Mock).mockResolvedValue([oilItem, filterItem]);
  (alertRepository.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
  (attachmentRepository.find as jest.Mock).mockResolvedValue([]);
  (maintenanceEventRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => ({ toObject: () => data }),
  );
  (recalculateVehicle as jest.Mock).mockResolvedValue({
    healthScore: 81,
    items: [
      { ...oilItem, status: "ok", cycle: 4, nextDueKm: 88900, nextDueDate: null },
      { ...filterItem, status: "ok", cycle: 1, nextDueKm: 93900, nextDueDate: null },
      { _id: new Types.ObjectId(), status: "overdue", cycle: 0, name: "Outro" },
    ],
  });
});

describe("registerMaintenanceEvent", () => {
  it("soma peças e mão de obra em centavos", async () => {
    const result = await registerMaintenanceEvent(requester, String(vehicleId), payload);

    const document = (maintenanceEventRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.totalCents).toBe(71000);
    expect(result.event.totalCents).toBe(71000);
    expect(document.source).toBe("manual");
    expect(document.date).toEqual(parseLocalDate("2026-08-15"));
  });

  it("copia o código do catálogo para o item do evento", async () => {
    await registerMaintenanceEvent(requester, String(vehicleId), payload);

    const document = (maintenanceEventRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.items[0].code).toBe("ENGINE_OIL");
    expect(document.items[2].planItemId).toBeNull();
  });

  it("dá baixa incrementando o ciclo e limpando o adiamento", async () => {
    await registerMaintenanceEvent(requester, String(vehicleId), payload);

    const [filter, update, options] = (planItemRepository.updateOne as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ _id: oilItemId });
    expect(update.$set).toMatchObject({
      lastServiceKm: 78900,
      lastServiceDate: parseLocalDate("2026-08-15"),
      snoozedUntil: null,
      snoozedUntilKm: null,
    });
    expect(update.$inc).toEqual({ cycle: 1 });
    expect(options).toEqual({ session: { id: "session" } });
  });

  it("não dá baixa em item que não foi trocado", async () => {
    await registerMaintenanceEvent(requester, String(vehicleId), {
      ...payload,
      items: [{ action: "inspect", description: "Revisão geral" }],
    });

    expect(planItemRepository.updateOne).not.toHaveBeenCalled();
    expect(alertRepository.updateMany).not.toHaveBeenCalled();
  });

  it("fecha os alertas abertos do ciclo que acabou", async () => {
    const result = await registerMaintenanceEvent(requester, String(vehicleId), payload);

    const [filter, update] = (alertRepository.updateMany as jest.Mock).mock.calls[0];
    expect(filter).toEqual({
      planItemId: oilItemId,
      cycle: { $lte: 3 },
      status: { $in: ["pending", "read", "snoozed"] },
    });
    expect(update.$set.status).toBe("resolved");
    expect(result.closedAlerts).toBe(2);
  });

  it("grava leitura de odômetro amarrada ao evento", async () => {
    await registerMaintenanceEvent(requester, String(vehicleId), payload);

    const [reading] = (odometerReadingRepository.insertOne as jest.Mock).mock.calls[0];
    expect(reading.source).toBe("service");
    expect(reading.km).toBe(78900);
    expect(reading.referenceId).toBeDefined();
  });

  it("devolve só os itens que mudaram, com status anterior e novo ciclo", async () => {
    const result = await registerMaintenanceEvent(requester, String(vehicleId), payload);

    expect(result.updatedItems).toHaveLength(2);
    expect(result.updatedItems[0]).toMatchObject({
      code: "ENGINE_OIL",
      previousStatus: "overdue",
      status: "ok",
      cycle: 4,
      nextDueKm: 88900,
    });
    expect(result.healthScore).toBe(81);
  });

  it("recusa quilometragem menor que a leitura anterior", async () => {
    (odometerReadingRepository.find as jest.Mock).mockResolvedValue([{ km: 80000 }]);

    await expect(
      registerMaintenanceEvent(requester, String(vehicleId), payload),
    ).rejects.toMatchObject({ statusCode: 422, code: "ODOMETER_REGRESSION" });
  });

  it("recusa data no futuro", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);

    await expect(
      registerMaintenanceEvent(requester, String(vehicleId), {
        ...payload,
        date: future.toISOString().slice(0, 10),
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "FUTURE_DATE" });
  });

  it("recusa item de plano de outro veículo", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([oilItem]);

    await expect(
      registerMaintenanceEvent(requester, String(vehicleId), payload),
    ).rejects.toMatchObject({ statusCode: 404, code: "PLAN_ITEM_NOT_FOUND" });
  });

  it("recusa id de item malformado", async () => {
    await expect(
      registerMaintenanceEvent(requester, String(vehicleId), {
        ...payload,
        items: [{ planItemId: "nao-e-id", action: "replace", description: "x" }],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "PLAN_ITEM_NOT_FOUND" });
  });

  it("vincula o anexo ao evento", async () => {
    const attachmentId = new Types.ObjectId();
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      { _id: attachmentId, type: "receipt", fileName: "nota.pdf" },
    ]);

    const result = await registerMaintenanceEvent(requester, String(vehicleId), {
      ...payload,
      attachmentIds: [String(attachmentId)],
    });

    const [, update] = (attachmentRepository.updateMany as jest.Mock).mock.calls[0];
    expect(update.$set.link).toEqual({
      collectionName: "maintenanceEvents",
      documentId: expect.anything(),
    });
    expect(result.event.attachments[0].fileName).toBe("nota.pdf");
  });

  it("recusa anexo de outro veículo", async () => {
    await expect(
      registerMaintenanceEvent(requester, String(vehicleId), {
        ...payload,
        attachmentIds: [String(new Types.ObjectId())],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "ATTACHMENT_NOT_FOUND" });
  });

  it("exige acesso de escrita e recalcula dentro da transação", async () => {
    await registerMaintenanceEvent(requester, String(vehicleId), payload);

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "write");
    expect(recalculateVehicle).toHaveBeenCalledWith(vehicle, { id: "session" });
  });

  it("marca a origem quick_log na baixa rápida", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([oilItem]);

    await registerMaintenanceEvent(
      requester,
      String(vehicleId),
      { km: 78900, items: [{ planItemId: String(oilItemId), action: "replace", description: "Óleo" }] },
      "quick_log",
    );

    expect((maintenanceEventRepository.insertOne as jest.Mock).mock.calls[0][0].source).toBe(
      "quick_log",
    );
  });
});
