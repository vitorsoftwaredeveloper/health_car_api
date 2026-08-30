import {
  doneItems,
  hasItem,
  mergeFindings,
  openItems,
  removeItem,
  setItemDone,
} from "../../src/domain/diagnostics";
import { ChecklistFinding, ChecklistItem } from "../../src/types/diagnostics";

const FIRST = new Date("2026-08-30T15:06:01.405Z");
const SECOND = new Date("2026-09-02T10:00:00.000Z");

const finding = (
  code: string,
  title = "Meça a bateria",
): ChecklistFinding => ({
  code,
  title,
  why: "porque a tensão passou de 15 V",
  priority: "soon",
});

const item = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  code: "voltage-high",
  title: "Meça a bateria",
  why: "porque sim",
  priority: "soon",
  createdAt: FIRST,
  lastSeenAt: FIRST,
  doneAt: null,
  ...overrides,
});

describe("mergeFindings", () => {
  it("abre pendência para achado inédito", () => {
    const merged = mergeFindings([], [finding("voltage-high")], FIRST);

    expect(merged).toHaveLength(1);
    expect(merged[0].createdAt).toEqual(FIRST);
    expect(merged[0].doneAt).toBeNull();
  });

  it("atualiza o texto sem perder a data de abertura", () => {
    const merged = mergeFindings(
      [item()],
      [finding("voltage-high", "Meça a bateria: 16.3 V")],
      SECOND,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].createdAt).toEqual(FIRST);
    expect(merged[0].lastSeenAt).toEqual(SECOND);
    expect(merged[0].title).toBe("Meça a bateria: 16.3 V");
  });

  it("não ressuscita pendência que a pessoa já validou", () => {
    const merged = mergeFindings(
      [item({ doneAt: SECOND })],
      [finding("voltage-high")],
      SECOND,
    );

    expect(merged[0].doneAt).toEqual(SECOND);
    expect(openItems(merged)).toHaveLength(0);
    expect(doneItems(merged)).toHaveLength(1);
  });

  it("mantém pendência que a leitura nova não encontrou", () => {
    const merged = mergeFindings([item({ code: "coolant-hot" })], [], SECOND);

    expect(merged).toHaveLength(1);
    expect(merged[0].lastSeenAt).toEqual(FIRST);
  });
});

describe("setItemDone", () => {
  it("marca e reabre a pendência", () => {
    const checked = setItemDone([item()], "voltage-high", true, SECOND);
    expect(checked[0].doneAt).toEqual(SECOND);

    const reopened = setItemDone(checked, "voltage-high", false, SECOND);
    expect(reopened[0].doneAt).toBeNull();
  });

  it("ignora código que não está na lista", () => {
    const items = [item()];
    expect(setItemDone(items, "outro", true, SECOND)).toEqual(items);
  });
});

describe("removeItem", () => {
  it("tira a pendência da lista", () => {
    expect(removeItem([item()], "voltage-high")).toEqual([]);
    expect(removeItem([item()], "outro")).toHaveLength(1);
  });
});

describe("hasItem", () => {
  it("responde se o código existe", () => {
    expect(hasItem([item()], "voltage-high")).toBe(true);
    expect(hasItem([item()], "outro")).toBe(false);
  });
});
