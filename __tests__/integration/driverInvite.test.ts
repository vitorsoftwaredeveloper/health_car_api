import { Types } from "mongoose";

jest.mock("../../src/libs/cognito", () => ({
  inviteCognitoUser: jest.fn(async () => ({
    cognitoSub: `cognito-${new Date().getTime()}`,
    alreadyExisted: false,
  })),
  deleteCognitoUser: jest.fn(),
  isCognitoConfigured: () => false,
}));

import { countIn, givenOwner, seedCatalogAndTemplate, vehiclePayload } from "./helpers";
import { createVehicle } from "../../src/services/vehicles/vehicle.service";
import {
  inviteDriver,
  listDrivers,
  revokeDriver,
} from "../../src/services/invites/invite.service";
import { getVehicleHealth } from "../../src/services/vehicles/health.service";
import { createOdometerReading } from "../../src/services/odometer/odometer.service";
import { getPlan } from "../../src/services/plan/plan.service";
import { userRepository } from "../../src/repositories/user.repository";
import { resolveRequester } from "../../src/services/users/requester.service";
import { UserDocument } from "../../src/types/user";
import { today } from "../../src/utils/date";

const asRequester = async (email: string) => {
  const user = (await userRepository.findOne({ email })) as UserDocument;

  return resolveRequester({
    sub: user.cognitoSub,
    email: user.email,
    groups: ["driver"],
    role: "driver",
  });
};

describe("VEI-08 — convite de condutor", () => {
  beforeEach(async () => {
    await seedCatalogAndTemplate();
  });

  const givenOwnerWithTwoVehicles = async (suffix: string) => {
    const owner = await givenOwner(suffix);
    const civic = await createVehicle(owner, vehiclePayload());
    const gol = await createVehicle(
      owner,
      vehiclePayload({
        nickname: "Gol",
        plate: "ABC1234",
        transmission: "manual",
        manufactureYear: 2018,
        modelYear: 2019,
      }),
    );

    return { owner, civic, gol };
  };

  it("convidado enxerga só o veículo do convite", async () => {
    const { owner, civic, gol } = await givenOwnerWithTwoVehicles("convite");

    const invited = await inviteDriver(owner, {
      email: "bruno@example.com",
      vehicleIds: [civic.id],
    });

    expect(invited.vehicles).toEqual([{ id: civic.id, nickname: "Meu Civic" }]);
    expect(await countIn("users", { role: "driver" })).toBe(1);

    const driver = await asRequester("bruno@example.com");
    expect(String(driver.accountId)).toBe(String(owner.accountId));

    await expect(getVehicleHealth(driver, civic.id)).resolves.toBeDefined();
    await expect(getVehicleHealth(driver, gol.id)).rejects.toMatchObject({
      code: "VEHICLE_NOT_FOUND",
    });
  });

  it("condutor registra quilometragem mas não mexe no plano", async () => {
    const { owner, civic } = await givenOwnerWithTwoVehicles("permissoes");
    await inviteDriver(owner, {
      email: "carla@example.com",
      vehicleIds: [civic.id],
    });

    const driver = await asRequester("carla@example.com");

    const reading = await createOdometerReading(driver, civic.id, {
      km: 79500,
      date: today().toISOString().slice(0, 10),
    });
    expect(reading.estimatedOdometer).toBe(79500);

    await expect(getPlan(driver, civic.id)).resolves.toBeDefined();
    await expect(
      inviteDriver(driver, { email: "x@example.com", vehicleIds: [civic.id] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("convidar de novo apenas acrescenta o veículo, sem duplicar o usuário", async () => {
    const { owner, civic, gol } = await givenOwnerWithTwoVehicles("reconvite");

    await inviteDriver(owner, {
      email: "dora@example.com",
      vehicleIds: [civic.id],
    });
    const second = await inviteDriver(owner, {
      email: "dora@example.com",
      vehicleIds: [gol.id],
    });

    expect(second.vehicles).toHaveLength(2);
    expect(await countIn("users", { role: "driver" })).toBe(1);
  });

  it("revogar tira o acesso e apaga o condutor", async () => {
    const { owner, civic } = await givenOwnerWithTwoVehicles("revoga");
    const invited = await inviteDriver(owner, {
      email: "elias@example.com",
      vehicleIds: [civic.id],
    });

    const driver = await asRequester("elias@example.com");
    await expect(getVehicleHealth(driver, civic.id)).resolves.toBeDefined();

    await revokeDriver(owner, invited.userId);

    expect(await countIn("users", { role: "driver" })).toBe(0);
    expect(
      await countIn("vehicles", {
        "drivers.userId": new Types.ObjectId(invited.userId),
      }),
    ).toBe(0);
    expect(await listDrivers(owner)).toHaveLength(0);
  });

  it("uma conta não convida para o veículo da outra", async () => {
    const { civic } = await givenOwnerWithTwoVehicles("titular");
    const outro = await givenOwner("intruso");

    await expect(
      inviteDriver(outro, { email: "fabio@example.com", vehicleIds: [civic.id] }),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });
});
