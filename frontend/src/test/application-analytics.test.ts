import { describe, expect, it, vi } from "vitest";
vi.mock("@/services/backend", () => ({ db: {}, auth: {} }));
import { applicationStageCounts } from "@/lib/application-analytics";

describe("application analytics", () => {
  it("counts each organizer record once", () => {
    const counts = applicationStageCounts([{ id: "a", status: "applied" }, { id: "b", status: "applied" }, { id: "a", status: "applied" }]);
    expect(counts.find((item) => item.stage === "applied")?.count).toBe(2);
    expect(counts.find((item) => item.stage === "saved")?.count).toBe(0);
  });
  it("keeps assessment and withdrawn distinct", () => {
    const counts = applicationStageCounts([{ id: "a", status: "assessment" }, { id: "b", status: "withdrawn" }]);
    expect(counts.find((item) => item.stage === "assessment")?.count).toBe(1);
    expect(counts.find((item) => item.stage === "withdrawn")?.count).toBe(1);
    expect(counts.find((item) => item.stage === "interviewing")?.count).toBe(0);
  });
  it("moves counts when a status changes", () => {
    expect(applicationStageCounts([{ id: "a", status: "applied" }]).find((item) => item.stage === "applied")?.count).toBe(1);
    const updated = applicationStageCounts([{ id: "a", status: "interviewing" }]);
    expect(updated.find((item) => item.stage === "applied")?.count).toBe(0);
    expect(updated.find((item) => item.stage === "interviewing")?.count).toBe(1);
  });
  it("returns zero counts for no applications", () => {
    expect(applicationStageCounts([]).map((item) => item.count)).toEqual([0, 0, 0, 0, 0]);
  });
});