import { Types } from "mongoose";
import {
  countIn,
  findPlanItem,
  givenOwner,
  seedCatalogAndTemplate,
  vehiclePayload,
} from "./helpers";
import { createVehicle } from "../../src/services/vehicles/vehicle.service";
import { registerMaintenanceEvent } from "../../src/services/maintenance/maintenance.service";
import { updateMe } from "../../src/services/users/me.service";
import {
  cancelAccountDeletion,
  exportAccountData,
  requestAccountDeletion,
} from "../../src/services/users/lgpd.service";
import { runAnonymizeAccounts } from "../../src/services/purge/anonymize.service";
import { accountRepository } from "../../src/repositories/account.repository";
import { userRepository } from "../../src/repositories/user.repository";
import { addDays, today } from "../../src/utils/date";

const givenAccountWithHistory = async (suffix: string) => {
  const owner = await givenOwner(suffix);
  await updateMe(owner, { phone: "+5585999990000" });

  const vehicle = await createVehicle(owner, vehiclePayload());
  const oil = await findPlanItem(vehicle.id, "ENGINE_OIL");

  await registerMaintenanceEvent(owner, vehicle.id, {
    km: 78900,
    items: [
      {
        planItemId: String(oil._id),
        action: "replace",
        description: "Óleo 5W30",
        partCents: 32000,
      },
    ],
  });

  return { owner, vehicle };
};

describe("LGPD — portabilidade e direito ao esquecimento", () => {
  beforeEach(async () => {
    await seedCatalogAndTemplate();
  });

  it("exporta o prontuário completo com placa e telefone decifrados", async () => {
    const { owner } = await givenAccountWithHistory("export");

    const data = (await exportAccountData(owner)) as any;

    expect(data.users[0].phone).toBe("+5585999990000");
    expect(data.vehicles[0].plate).toBe("BRA2E19");
    expect(data.vehicles).toHaveLength(1);
    expect(data.planItems.length).toBeGreaterThan(30);
    expect(data.maintenanceEvents).toHaveLength(1);
    expect(data.odometerReadings.length).toBeGreaterThan(1);
  });

  it("uma conta nunca exporta dado da outra", async () => {
    await givenAccountWithHistory("titular");
    const outro = await givenOwner("curioso");

    const data = (await exportAccountData(outro)) as any;

    expect(data.vehicles).toHaveLength(0);
    expect(data.maintenanceEvents).toHaveLength(0);
    expect(data.users).toHaveLength(1);
  });

  it("pedido de exclusão fica em carência e pode ser cancelado", async () => {
    const { owner } = await givenAccountWithHistory("arrependido");

    const requested = await requestAccountDeletion(owner);
    expect(requested.status).toBe("pending_deletion");

    const beforeGrace = await runAnonymizeAccounts(new Date());
    expect(beforeGrace.accountsAnonymized).toBe(0);
    expect(await countIn("vehicles")).toBe(1);

    const cancelled = await cancelAccountDeletion(owner);
    expect(cancelled.status).toBe("active");

    const afterCancel = await runAnonymizeAccounts(addDays(today(), 60));
    expect(afterCancel.accountsAnonymized).toBe(0);
    expect(await countIn("vehicles")).toBe(1);
  });

  it("depois da carência apaga os dados do carro e anonimiza a pessoa", async () => {
    const { owner } = await givenAccountWithHistory("esquecido");

    await requestAccountDeletion(owner);
    const result = await runAnonymizeAccounts(addDays(today(), 31));

    expect(result.accountsAnonymized).toBe(1);
    expect(result.usersAnonymized).toBe(1);

    expect(await countIn("vehicles")).toBe(0);
    expect(await countIn("planItems")).toBe(0);
    expect(await countIn("odometerReadings")).toBe(0);
    expect(await countIn("maintenanceEvents")).toBe(0);
    expect(await countIn("alerts")).toBe(0);

    const account = (await accountRepository.findById(owner.accountId)) as any;
    expect(account.status).toBe("anonymized");

    const user = (await userRepository.findOne({
      _id: new Types.ObjectId(String(owner.userId)),
    })) as any;
    expect(user.name).toBe("Usuário removido");
    expect(user.email).toContain("removed.healthcar.invalid");
    expect(user.phone).toBeNull();
    expect(user.anonymizedAt).toBeTruthy();
  });
});
