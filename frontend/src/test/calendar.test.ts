import { describe, expect, it } from "vitest";
import { addMonths, allDayIso, eventLocalDay, layoutOverlaps, monthGrid, occursOn, categoryOf } from "@/lib/calendar";

const ev = (id: string, s: string, e: string | null, all_day = false) =>
  ({ id, type: "INTERVIEW", title: id, notes: null, location: null, all_day, starts_at: s, ends_at: e, application_id: null });

describe("calendar dates", () => {
  it("month navigation clamps to shorter months and handles leap years", () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
    expect(addMonths(new Date(2026, 11, 15), 1)).toEqual(new Date(2027, 0, 15));
  });
  it("month grid starts on Sunday and contains the 1st", () => {
    const g = monthGrid(new Date(2026, 9, 27));
    expect(g).toHaveLength(42);
    expect(g[0]!.getDay()).toBe(0);
    expect(g.some((d) => d.getMonth() === 9 && d.getDate() === 1)).toBe(true);
  });
  it("all-day events stay on their calendar date", () => {
    const d = eventLocalDay(ev("a", allDayIso("2026-11-03"), null, true));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 3]);
    expect(occursOn(ev("a", allDayIso("2026-11-03"), null, true), new Date(2026, 10, 4))).toBe(false);
  });
  it("overlapping events get separate columns", () => {
    const m = layoutOverlaps([ev("a", "2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z"), ev("b", "2026-11-03T10:30:00Z", "2026-11-03T11:30:00Z"), ev("c", "2026-11-03T12:00:00Z", null)]);
    expect(m.get("a")).toEqual({ col: 0, cols: 2 });
    expect(m.get("b")).toEqual({ col: 1, cols: 2 });
    expect(m.get("c")).toEqual({ col: 0, cols: 1 });
  });
  it("legacy categories map to current ones", () => {
    expect(categoryOf("PREP_TASK").label).toBe("Preparation");
    expect(categoryOf("DEADLINE").label).toBe("Application deadline");
  });
});
