import { Types } from "mongoose";

jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock("../../src/repositories/odometerReading.repository", () => ({
  odometerReadingRepository: { deleteMany: jest.fn(), updateMany: jest.fn() },
}));
jest.mock("../../src/repositories/planItem.repository", () => ({
  planItemRepository: { find: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { updateMany: jest.fn() },
}));
jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { updateMany: jest.fn(), find: jest.fn() },
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
import {
  reverseMaintenanceEvent,
  updateMaintenanceEvent,
} from "../../src/services/maintenance/eventRevision.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";
import { parseLocalDate } from "../../src/utils/date";

const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();
const eventId = new Types.ObjectId();
const oilItemId = new Types.ObjectId();

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
  accountId,
  date: parseLocalDate("2026-08-15"),
  km: 78900,
  type: "preventive",
  items: [
    {
      planItemId: oilItemId,
      code: "ENGINE_OIL",
      action: "replace",
      description: "Óleo 5W30",
      partCents: 32000,
    },
  ],
  totalCents: 32000,
  source: "manual",
  ...overrides,
});

const recalculated = (cycle = 4, status = "overdue") => ({
  healthScore: 61,
  items: [
    {
      _id: oilItemId,
      code: "ENGINE_OIL",
      name: "Óleo do motor + filtro",
      status,
      cycle,
      lastServiceKm: null,
      lastServiceDate: null,
    },
  ],
});

beforeEach(() => {
  (assertVehicleAccess as jest.Mock).mockResolvedValue(vehicle);
  (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(event());
  (maintenanceEventRepository.find as jest.Mock).mockResolvedValue([]);
  (maintenanceEventRepository.findOneAndUpdate as jest.Mock).mockImplementation(
    async (_filter: any, update: any) => event(update.$set),
  );
  (planItemRepository.find as jest.Mock).mockResolvedValue([
    { _id: oilItemId, code: "ENGINE_OIL", vehicleId },
  ]);
  (recalculateVehicle as jest.Mock).mockResolvedValue(recalculated());
  (attachmentRepository.find as jest.Mock).mockResolvedValue([]);
});

describe("reverseMaintenanceEvent", () => {
  it("apaga o evento e a leitura que ele gerou", async () => {
    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    expect(maintenanceEventRepository.deleteOne).toHaveBeenCalledWith(
      { _id: eventId },
      { session: { id: "session" } },
    );
    expect((odometerReadingRepository.deleteMany as jest.Mock).mock.calls[0][0]).toEqual({
      vehicleId,
      referenceId: eventId,
      source: "service",
    });
  });

  it("não retrocede o ciclo do item", async () => {
    const result = await reverseMaintenanceEvent(
      requester,
      String(vehicleId),
      String(eventId),
    );

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).not.toHaveProperty("cycle");
    expect(result.restatedItems[0].cycle).toBe(4);
    expect(result.restatedItems[0].status).toBe("overdue");
  });

  it("zera a última troca quando não sobrou evento para o item", async () => {
    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toEqual({
      lastServiceKm: null,
      lastServiceDate: null,
      lastServiceEventId: null,
    });
  });

  it("volta a última troca para o evento anterior que sobrou", async () => {
    const olderId = new Types.ObjectId();
    (maintenanceEventRepository.find as jest.Mock).mockResolvedValue([
      { _id: olderId, km: 62000, date: parseLocalDate("2025-05-09") },
    ]);

    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    const update = (planItemRepository.updateOne as jest.Mock).mock.calls[0][1].$set;
    expect(update).toEqual({
      lastServiceKm: 62000,
      lastServiceDate: parseLocalDate("2025-05-09"),
      lastServiceEventId: olderId,
    });
  });

  it("procura o evento anterior pelo item, do mais novo para o mais velho", async () => {
    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    const [filter, , options] = (maintenanceEventRepository.find as jest.Mock).mock.calls[0];
    expect(filter.items.$elemMatch).toEqual({
      planItemId: oilItemId,
      action: "replace",
    });
    expect(options).toMatchObject({ sort: { date: -1, createdAt: -1 }, limit: 1 });
  });

  it("solta o anexo e a referência do alerta resolvido", async () => {
    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    expect((attachmentRepository.updateMany as jest.Mock).mock.calls[0][1].$set.link).toBeNull();
    expect(
      (alertRepository.updateMany as jest.Mock).mock.calls[0][1].$set.resolvedByEventId,
    ).toBeNull();
  });

  it("exige papel de gestão", async () => {
    await reverseMaintenanceEvent(requester, String(vehicleId), String(eventId));

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "manage");
  });

  it("recusa evento inexistente", async () => {
    (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      reverseMaintenanceEvent(requester, String(vehicleId), String(eventId)),
    ).rejects.toMatchObject({ statusCode: 404, code: "MAINTENANCE_EVENT_NOT_FOUND" });
  });
});

describe("updateMaintenanceEvent", () => {
  const payload = {
    date: "2026-08-16",
    km: 79000,
    items: [
      {
        planItemId: String(oilItemId),
        action: "replace" as const,
        description: "Óleo 5W40",
        partCents: 35000,
      },
    ],
    laborCents: 10000,
  };

  it("recalcula o total e a leitura vinculada", async () => {
    const result = await updateMaintenanceEvent(
      requester,
      String(vehicleId),
      String(eventId),
      payload,
    );

    const update = (maintenanceEventRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.totalCents).toBe(45000);
    expect(update.km).toBe(79000);
    expect(update.date).toEqual(parseLocalDate("2026-08-16"));

    const readingUpdate = (odometerReadingRepository.updateMany as jest.Mock).mock.calls[0][1].$set;
    expect(readingUpdate).toEqual({ km: 79000, date: parseLocalDate("2026-08-16") });
    expect(result.event?.totalCents).toBe(45000);
  });

  it("refaz a última troca dos itens que entraram e dos que saíram", async () => {
    const otherItemId = new Types.ObjectId();
    (planItemRepository.find as jest.Mock).mockResolvedValue([
      { _id: otherItemId, code: "CABIN_FILTER", vehicleId },
    ]);

    await updateMaintenanceEvent(requester, String(vehicleId), String(eventId), {
      ...payload,
      items: [
        {
          planItemId: String(otherItemId),
          action: "replace",
          description: "Filtro de cabine",
        },
      ],
    });

    const touched = (planItemRepository.updateOne as jest.Mock).mock.calls.map(
      (call) => String(call[0]._id),
    );
    expect(touched).toEqual([String(oilItemId), String(otherItemId)]);
  });

  it("recusa data no futuro", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);

    await expect(
      updateMaintenanceEvent(requester, String(vehicleId), String(eventId), {
        ...payload,
        date: future.toISOString().slice(0, 10),
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: "FUTURE_DATE" });
  });

  it("recusa item de plano de outro veículo", async () => {
    (planItemRepository.find as jest.Mock).mockResolvedValue([]);

    await expect(
      updateMaintenanceEvent(requester, String(vehicleId), String(eventId), payload),
    ).rejects.toMatchObject({ statusCode: 404, code: "PLAN_ITEM_NOT_FOUND" });
  });

  it("aceita edição por quem tem acesso de escrita", async () => {
    await updateMaintenanceEvent(requester, String(vehicleId), String(eventId), payload);

    expect(assertVehicleAccess).toHaveBeenCalledWith(requester, String(vehicleId), "write");
  });

  it("mantém os anexos quando a edição não fala de anexo", async () => {
    const attachmentId = new Types.ObjectId();
    (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(
      event({
        attachments: [{ attachmentId, type: "receipt", fileName: "nota.pdf" }],
      }),
    );

    await updateMaintenanceEvent(requester, String(vehicleId), String(eventId), payload);

    const update = (maintenanceEventRepository.findOneAndUpdate as jest.Mock).mock
      .calls[0][1].$set;
    expect(update.attachments).toEqual([
      { attachmentId, type: "receipt", fileName: "nota.pdf" },
    ]);
    expect(attachmentRepository.updateMany).not.toHaveBeenCalled();
  });

  it("vincula o recibo novo enviado na edição", async () => {
    const attachmentId = new Types.ObjectId();
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      { _id: attachmentId, type: "receipt", fileName: "nota.pdf", vehicleId },
    ]);

    await updateMaintenanceEvent(requester, String(vehicleId), String(eventId), {
      ...payload,
      attachmentIds: [String(attachmentId)],
    });

    const link = (attachmentRepository.updateMany as jest.Mock).mock.calls[0][1].$set
      .link;
    expect(link).toEqual({
      collectionName: "maintenanceEvents",
      documentId: eventId,
    });

    const update = (maintenanceEventRepository.findOneAndUpdate as jest.Mock).mock
      .calls[0][1].$set;
    expect(update.attachments).toEqual([
      { attachmentId, type: "receipt", fileName: "nota.pdf" },
    ]);
  });

  it("solta o recibo que saiu da lista da edição", async () => {
    const removedId = new Types.ObjectId();
    (maintenanceEventRepository.findOne as jest.Mock).mockResolvedValue(
      event({
        attachments: [
          { attachmentId: removedId, type: "receipt", fileName: "errada.pdf" },
        ],
      }),
    );

    await updateMaintenanceEvent(requester, String(vehicleId), String(eventId), {
      ...payload,
      attachmentIds: [],
    });

    const [filter, update] = (attachmentRepository.updateMany as jest.Mock).mock
      .calls[0];
    expect(filter).toEqual({ _id: { $in: [removedId] } });
    expect(update.$set.link).toBeNull();

    const eventUpdate = (maintenanceEventRepository.findOneAndUpdate as jest.Mock).mock
      .calls[0][1].$set;
    expect(eventUpdate.attachments).toEqual([]);
  });

  it("recusa anexo que não é do veículo", async () => {
    await expect(
      updateMaintenanceEvent(requester, String(vehicleId), String(eventId), {
        ...payload,
        attachmentIds: [String(new Types.ObjectId())],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "ATTACHMENT_NOT_FOUND" });
  });
});
