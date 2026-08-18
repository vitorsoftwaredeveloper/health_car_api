jest.mock("../../src/domain/due", () => ({
  ...jest.requireActual("../../src/domain/due"),
  computeItemStatus: jest.fn(),
}));

import { computeItemStatus } from "../../src/domain/due";
import { computeHealthScore, itemHealth } from "../../src/domain/health";
import { ctx, item } from "./factories";

const mocked = computeItemStatus as jest.Mock;

describe("itemHealth: item sem base de consumo fica fora da nota", () => {
  it("status calculavel sem fracao consumida devolve null", () => {
    mocked.mockReturnValue({
      status: "ok",
      dueDate: null,
      dueReason: null,
      nextDueKm: null,
      nextDueDate: null,
      kmRemaining: null,
      daysRemaining: null,
    });

    const semBase = item({
      intervalKm: null,
      intervalMonths: null,
      lastServiceKm: null,
      lastServiceDate: null,
    });

    expect(itemHealth(semBase, ctx())).toBeNull();
    expect(computeHealthScore([semBase], ctx())).toBe(100);
  });
});
