import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANDIDATE_SIDEBAR_KEY, useCandidateSidebar } from "@/lib/use-candidate-sidebar";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("Candidate sidebar preference", () => {
  it("defaults to expanded and toggles in both directions", () => {
    const { result } = renderHook(useCandidateSidebar);
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it("restores the collapsed preference after remount without changing admin storage", () => {
    localStorage.setItem("careeros-admin-sidebar-collapsed", "false");
    const first = renderHook(useCandidateSidebar);
    act(() => first.result.current.toggle());
    expect(localStorage.getItem(CANDIDATE_SIDEBAR_KEY)).toBe("true");
    first.unmount();
    const second = renderHook(useCandidateSidebar);
    expect(second.result.current.collapsed).toBe(true);
    expect(localStorage.getItem("careeros-admin-sidebar-collapsed")).toBe("false");
  });

  it("remains usable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Restricted"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Restricted"); });
    const { result } = renderHook(useCandidateSidebar);
    expect(result.current.ready).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
  });
});