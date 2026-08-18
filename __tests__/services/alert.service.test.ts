import { Types } from "mongoose";

jest.mock("../../src/repositories/alert.repository", () => ({
  alertRepository: { insertOne: jest.fn() },
}));

import { alertRepository } from "../../src/repositories/alert.repository";
import { syncAlertsForVehicle } from "../../src/services/alerts/alert.service";
import { RecalculationResult } from "../../src/services/plan/recalculate.service";
import { VehicleDocument } from "../../src/types/vehicle";
import { addDays, today } from "../../src/utils/date";
import { DUPLICATE_KEY_ERROR_CODE } from "../../src/utils/errors";

const vehicleId = new Types.ObjectId();
const accountId = new Types.ObjectId();
const vehicle = { _id: vehicleId, accountId } as VehicleDocument;

const evaluation = (overrides: any = {}) => ({
  item: {
    _id: new Types.ObjectId(),
    name: "Fluido de freio",
    criticality: "critical",
    cycle: 2,
    active: true,
    muted: false,
    dueType: "time",
    ...(overrides.item ?? {}),
  },
  result: {
    status: "overdue",
    dueDate: addDays(today(), -10),
    dueReason: "time",
    kmRemaining: null,
    daysRemaining: -10,
    nextDueKm: null,
    nextDueDate: null,
    ...(overrides.result ?? {}),
  },
});

const recalculation = (evaluations: any[]): RecalculationResult =>
  ({
    estimatedOdometer: 79000,
    kmPerDay: 40,
    evaluations,
  }) as RecalculationResult;

beforeEach(() => {
  (alertRepository.insertOne as jest.Mock).mockImplementation(async (data: any) => ({
    toObject: () => ({ _id: new Types.ObjectId(), ...data }),
  }));
});

describe("syncAlertsForVehicle", () => {
  it("cria alerta do marco cruzado com severidade e ciclo do item", async () => {
    const result = await syncAlertsForVehicle(vehicle, recalculation([evaluation()]));

    const document = (alertRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document).toMatchObject({
      accountId,
      vehicleId,
      cycle: 2,
      milestone: "OVERDUE_W2",
      severity: "urgent",
      title: "Fluido de freio venceu",
      status: "pending",
    });
    expect(document.message).toBe("Vencido há 10 dias, por tempo.");
    expect(result.created).toHaveLength(1);
  });

  it("escolhe o marco pela data de vencimento efetiva", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([
        evaluation({ result: { status: "due_soon", dueDate: addDays(today(), 20) } }),
      ]),
    );

    expect((alertRepository.insertOne as jest.Mock).mock.calls[0][0].milestone).toBe("D30");
  });

  it("não alerta item sem histórico", async () => {
    const result = await syncAlertsForVehicle(
      vehicle,
      recalculation([
        evaluation({ result: { status: "unknown", dueDate: null } }),
      ]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
  });

  it("não alerta item desativado", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([evaluation({ item: { active: false } })]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("não alerta item silenciado", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([evaluation({ item: { muted: true } })]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("não alerta item adiado por data", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([evaluation({ item: { snoozedUntil: addDays(today(), 5) } })]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("não alerta item adiado por quilometragem", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([evaluation({ item: { snoozedUntilKm: 90000 } })]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("não alerta item ainda longe do vencimento", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([
        evaluation({ result: { status: "ok", dueDate: addDays(today(), 120) } }),
      ]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("para de alertar depois de oito semanas vencido", async () => {
    await syncAlertsForVehicle(
      vehicle,
      recalculation([
        evaluation({ result: { dueDate: addDays(today(), -60) } }),
      ]),
    );

    expect(alertRepository.insertOne).not.toHaveBeenCalled();
  });

  it("conta duplicata sem quebrar quando o marco já existe no ciclo", async () => {
    (alertRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    const result = await syncAlertsForVehicle(vehicle, recalculation([evaluation()]));

    expect(result).toEqual({ created: [], duplicates: 1 });
  });

  it("propaga erro que não é de chave duplicada", async () => {
    (alertRepository.insertOne as jest.Mock).mockRejectedValue(new Error("mongo caiu"));

    await expect(
      syncAlertsForVehicle(vehicle, recalculation([evaluation()])),
    ).rejects.toThrow("mongo caiu");
  });
});
