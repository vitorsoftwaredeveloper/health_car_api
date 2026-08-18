import { Types } from "mongoose";

jest.mock("../../src/repositories/vehicle.repository", () => ({
  vehicleRepository: {
    findOne: jest.fn(),
    find: jest.fn(),
    insertOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    count: jest.fn(),
  },
}));
jest.mock("../../src/repositories/account.repository", () => ({
  accountRepository: { findById: jest.fn() },
}));
jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));
jest.mock("../../src/services/plan/plan.service", () => ({
  applyTemplateToVehicle: jest.fn(async () => ({
    templateName: "Genérico",
    created: 20,
    skipped: 27,
  })),
}));
jest.mock("../../src/libs/crypto", () => ({
  encrypt: jest.fn(async (value: string) => `ENC:${value}`),
  decrypt: jest.fn(async (value: string) => value.replace("ENC:", "")),
  hashForLookup: jest.fn(async (value: string) => `HASH:${value}`),
}));

import { vehicleRepository } from "../../src/repositories/vehicle.repository";
import { applyTemplateToVehicle } from "../../src/services/plan/plan.service";
import { accountRepository } from "../../src/repositories/account.repository";
import { assertVehicleAccess } from "../../src/services/vehicles/access.service";
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  updateVehicle,
} from "../../src/services/vehicles/vehicle.service";
import { Requester } from "../../src/types/user";
import { VehicleDocument } from "../../src/types/vehicle";
import { DUPLICATE_KEY_ERROR_CODE } from "../../src/utils/errors";

const userId = new Types.ObjectId();
const accountId = new Types.ObjectId();
const vehicleId = new Types.ObjectId();

const owner: Requester = {
  userId,
  accountId,
  role: "owner",
  user: {} as any,
};

const driverUserId = new Types.ObjectId();
const driver: Requester = {
  userId: driverUserId,
  accountId: new Types.ObjectId(),
  role: "driver",
  user: {} as any,
};

const storedVehicle = (overrides: Partial<VehicleDocument> = {}): VehicleDocument =>
  ({
    _id: vehicleId,
    accountId,
    nickname: "Meu Civic",
    make: "Honda",
    model: "Civic",
    manufactureYear: 2019,
    modelYear: 2020,
    fuel: "flex",
    plate: "ENC:BRA2E19",
    plateHash: "HASH:BRA2E19",
    vin: null,
    currentOdometer: 77140,
    currentOdometerAt: new Date("2026-08-02"),
    kmPerDay: 33,
    healthScore: 100,
    drivers: [{ userId: driverUserId, role: "driver", addedAt: new Date() }],
    status: "active",
    ...overrides,
  }) as VehicleDocument;

const validPayload = {
  nickname: "Meu Civic",
  make: "Honda",
  model: "Civic",
  manufactureYear: 2019,
  modelYear: 2020,
  fuel: "flex" as const,
  plate: "bra-2e19",
  currentOdometer: 77140,
};

beforeEach(() => {
  (accountRepository.findById as jest.Mock).mockResolvedValue({ vehicleLimit: 3 });
  (vehicleRepository.count as jest.Mock).mockResolvedValue(0);
  (vehicleRepository.insertOne as jest.Mock).mockImplementation(
    async (data: any) => ({ toObject: () => data }),
  );
  (vehicleRepository.findOne as jest.Mock).mockResolvedValue(storedVehicle());
});

describe("createVehicle", () => {
  it("normaliza, cifra a placa e guarda o hash de busca", async () => {
    const view = await createVehicle(owner, validPayload);

    const document = (vehicleRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.plate).toBe("ENC:BRA2E19");
    expect(document.plateHash).toBe("HASH:BRA2E19");
    expect(document.drivers[0].userId).toBe(userId);
    expect(document.kmPerDay).toBe(33);
    expect(view.plate).toBe("BRA2E19");
    expect(view.healthScore).toBe(100);
  });

  it("aplica o template na mesma transação", async () => {
    const view = await createVehicle(owner, validPayload);

    const [vehicleArg, sessionArg] = (applyTemplateToVehicle as jest.Mock).mock.calls[0];
    expect(vehicleArg.plate).toBe("ENC:BRA2E19");
    expect(sessionArg).toEqual({ id: "session" });
    expect(view.plan).toEqual({ templateName: "Genérico", created: 20, skipped: 27 });
  });

  it("respeita applyTemplate false", async () => {
    const view = await createVehicle(owner, { ...validPayload, applyTemplate: false });

    expect(applyTemplateToVehicle).not.toHaveBeenCalled();
    expect(view.plan).toEqual({ templateName: null, created: 0, skipped: 0 });
  });

  it("aceita placa no padrão antigo", async () => {
    await expect(
      createVehicle(owner, { ...validPayload, plate: "ABC1234" }),
    ).resolves.toMatchObject({ plate: "ABC1234" });
  });

  it("recusa placa fora do padrão", async () => {
    await expect(
      createVehicle(owner, { ...validPayload, plate: "1234ABC" }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INVALID_PLATE" });
  });

  it("recusa ano de modelo incoerente", async () => {
    await expect(
      createVehicle(owner, { ...validPayload, modelYear: 2025 }),
    ).rejects.toMatchObject({ statusCode: 422, code: "INCONSISTENT_MODEL_YEAR" });
  });

  it("barra o quarto veículo da conta", async () => {
    (vehicleRepository.count as jest.Mock).mockResolvedValue(3);

    await expect(createVehicle(owner, validPayload)).rejects.toMatchObject({
      statusCode: 409,
      code: "VEHICLE_LIMIT_REACHED",
    });
  });

  it("barra placa repetida na conta", async () => {
    (vehicleRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    await expect(createVehicle(owner, validPayload)).rejects.toMatchObject({
      statusCode: 409,
      code: "PLATE_ALREADY_REGISTERED",
    });
  });

  it("cifra o VIN quando informado", async () => {
    await createVehicle(owner, { ...validPayload, vin: "9bwzzz377vt004251" });

    const document = (vehicleRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(document.vin).toBe("ENC:9BWZZZ377VT004251");
  });
});

describe("listVehicles", () => {
  it("busca veículos da conta e os conduzidos", async () => {
    (vehicleRepository.find as jest.Mock).mockResolvedValue([storedVehicle()]);

    const list = await listVehicles(owner);

    const filter = (vehicleRepository.find as jest.Mock).mock.calls[0][0];
    expect(filter.$or).toEqual([
      { accountId },
      { "drivers.userId": userId },
    ]);
    expect(list[0].plate).toBe("BRA2E19");
  });
});

describe("assertVehicleAccess", () => {
  it("devolve o veículo para o dono da conta", async () => {
    await expect(
      assertVehicleAccess(owner, String(vehicleId), "manage"),
    ).resolves.toMatchObject({ _id: vehicleId });
  });

  it("devolve o veículo para o condutor vinculado", async () => {
    await expect(
      assertVehicleAccess(driver, String(vehicleId), "read"),
    ).resolves.toMatchObject({ _id: vehicleId });
  });

  it("esconde veículo de outra conta com 404", async () => {
    const stranger: Requester = {
      userId: new Types.ObjectId(),
      accountId: new Types.ObjectId(),
      role: "owner",
      user: {} as any,
    };

    await expect(
      assertVehicleAccess(stranger, String(vehicleId), "read"),
    ).rejects.toMatchObject({ statusCode: 404, code: "VEHICLE_NOT_FOUND" });
  });

  it("recusa id malformado com 404", async () => {
    await expect(
      assertVehicleAccess(owner, "nao-e-objectid", "read"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("recusa veículo inexistente com 404", async () => {
    (vehicleRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      assertVehicleAccess(owner, String(vehicleId), "read"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("impede condutor de gerenciar o veículo", async () => {
    await expect(
      assertVehicleAccess(driver, String(vehicleId), "manage"),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("impede dono de outra conta de gerenciar veículo que só conduz", async () => {
    const guestOwner: Requester = {
      userId: driverUserId,
      accountId: new Types.ObjectId(),
      role: "owner",
      user: {} as any,
    };

    await expect(
      assertVehicleAccess(guestOwner, String(vehicleId), "manage"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("getVehicle", () => {
  it("devolve a ficha decifrada", async () => {
    await expect(getVehicle(owner, String(vehicleId))).resolves.toMatchObject({
      plate: "BRA2E19",
      nickname: "Meu Civic",
    });
  });
});

describe("updateVehicle", () => {
  it("recifra a placa e mantém o status atual quando não informado", async () => {
    (vehicleRepository.findOneAndUpdate as jest.Mock).mockImplementation(
      async (_filter: any, update: any) => storedVehicle(update.$set),
    );

    const view = await updateVehicle(owner, String(vehicleId), {
      ...validPayload,
      plate: "ABC1234",
    });

    const update = (vehicleRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.plate).toBe("ENC:ABC1234");
    expect(update.plateHash).toBe("HASH:ABC1234");
    expect(update.status).toBe("active");
    expect(view.plate).toBe("ABC1234");
  });

  it("grava o novo status quando informado", async () => {
    (vehicleRepository.findOneAndUpdate as jest.Mock).mockImplementation(
      async (_filter: any, update: any) => storedVehicle(update.$set),
    );

    await updateVehicle(owner, String(vehicleId), {
      ...validPayload,
      status: "sold",
    });

    const update = (vehicleRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.status).toBe("sold");
  });

  it("falha quando o veículo some no meio da atualização", async () => {
    (vehicleRepository.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await expect(
      updateVehicle(owner, String(vehicleId), validPayload),
    ).rejects.toMatchObject({ statusCode: 404, code: "VEHICLE_NOT_FOUND" });
  });

  it("barra placa repetida na atualização", async () => {
    (vehicleRepository.findOneAndUpdate as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    await expect(
      updateVehicle(owner, String(vehicleId), validPayload),
    ).rejects.toMatchObject({ statusCode: 409, code: "PLATE_ALREADY_REGISTERED" });
  });
});

describe("deleteVehicle", () => {
  it("remove o veículo do dono", async () => {
    await deleteVehicle(owner, String(vehicleId));

    expect(vehicleRepository.deleteOne).toHaveBeenCalledWith({ _id: vehicleId });
  });
});
