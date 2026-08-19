import {
  buildNotificationContent,
  decideNotification,
  filterAlertsByPreferences,
  NotifiableAlert,
} from "../../src/domain/notification";
import { defaultPreferences, mergePreferences } from "../../src/domain/preferences";

const alert = (overrides: Partial<NotifiableAlert> = {}): NotifiableAlert => ({
  id: "a1",
  milestone: "D7",
  title: "Fluido de freio vence esta semana",
  message: "Vence em 5 dias, por tempo.",
  planItemId: "p1",
  itemName: "Fluido de freio",
  ...overrides,
});

const input = (overrides: any = {}) => ({
  preferences: defaultPreferences(),
  alerts: [alert()],
  hasActiveDevice: true,
  alreadyNotifiedToday: false,
  localTime: "06:00",
  ...overrides,
});

describe("filterAlertsByPreferences", () => {
  it("descarta alerta de marco desligado", () => {
    const preferences = mergePreferences(defaultPreferences(), {
      milestones: { D7: false },
    });

    const kept = filterAlertsByPreferences(
      [alert(), alert({ id: "a2", milestone: "D0" })],
      preferences,
    );

    expect(kept.map((a) => a.id)).toEqual(["a2"]);
  });

  it("resolve o marco semanal pelo prefixo", () => {
    const preferences = mergePreferences(defaultPreferences(), {
      milestones: { OVERDUE_WEEKLY: false },
    });

    expect(
      filterAlertsByPreferences([alert({ milestone: "OVERDUE_W4" })], preferences),
    ).toHaveLength(0);
  });
});

describe("decideNotification", () => {
  it("libera o envio quando tudo está no lugar", () => {
    expect(decideNotification(input()).skipReason).toBeNull();
  });

  it("não envia no horário padrão da madrugada", () => {
    expect(decideNotification(input({ localTime: "23:30" })).skipReason).toBe("quiet_hours");
  });

  it("deixa passar o job das 06:00 com a faixa padrão", () => {
    expect(decideNotification(input({ localTime: "06:00" })).skipReason).toBeNull();
  });

  it("marca marco desligado", () => {
    const preferences = mergePreferences(defaultPreferences(), {
      milestones: { D7: false },
    });

    expect(decideNotification(input({ preferences })).skipReason).toBe("milestone_disabled");
  });

  it("marca push desligado", () => {
    const preferences = mergePreferences(defaultPreferences(), { pushEnabled: false });

    expect(decideNotification(input({ preferences })).skipReason).toBe("push_disabled");
  });

  it("marca envio repetido no mesmo dia", () => {
    expect(decideNotification(input({ alreadyNotifiedToday: true })).skipReason).toBe(
      "already_sent_today",
    );
  });

  it("marca ausência de dispositivo", () => {
    expect(decideNotification(input({ hasActiveDevice: false })).skipReason).toBe("no_device");
  });

  it("devolve os alertas filtrados junto com o motivo", () => {
    const decision = decideNotification(
      input({ alerts: [alert(), alert({ id: "a2", milestone: "D30" })] }),
    );

    expect(decision.alerts).toHaveLength(2);
  });
});

describe("buildNotificationContent", () => {
  it("usa o título do alerta quando é um só, com deeplink do item", () => {
    const content = buildNotificationContent("Meu Civic", "v1", [alert()]);

    expect(content.title).toBe("Fluido de freio vence esta semana");
    expect(content.body).toBe("Meu Civic: Vence em 5 dias, por tempo.");
    expect(content.deepLink).toBe("/vehicles/v1?item=p1");
  });

  it("agrega dois itens num push só", () => {
    const content = buildNotificationContent("Meu Civic", "v1", [
      alert(),
      alert({ id: "a2", itemName: "Óleo do motor" }),
    ]);

    expect(content.title).toBe("Meu Civic: 2 itens pedindo atenção");
    expect(content.body).toBe("Fluido de freio e Óleo do motor.");
    expect(content.deepLink).toBe("/vehicles/v1");
  });

  it("resume o excedente quando passa de dois itens", () => {
    const content = buildNotificationContent("Meu Civic", "v1", [
      alert(),
      alert({ id: "a2", itemName: "Óleo do motor" }),
      alert({ id: "a3", itemName: "Velas" }),
      alert({ id: "a4", itemName: "Pneus" }),
    ]);

    expect(content.title).toBe("Meu Civic: 4 itens pedindo atenção");
    expect(content.body).toBe("Fluido de freio e Óleo do motor e mais 2.");
  });
});
