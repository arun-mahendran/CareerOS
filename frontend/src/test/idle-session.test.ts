import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleSession } from "@/lib/idle-session";
import { SESSION_CONFIG } from "@/lib/session-config";

describe("shared inactivity deadlines", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => vi.useRealTimers());
  it("warns after 28 minutes and expires after 30", () => {
    const warn = vi.fn(), expire = vi.fn();
    const idle = new IdleSession(Date.now(), SESSION_CONFIG.timeoutMs, SESSION_CONFIG.warningMs, warn, expire);
    expect(SESSION_CONFIG.timeoutMs).toBe(30 * 60_000);
    expect(SESSION_CONFIG.warningMs).toBe(2 * 60_000);
    vi.advanceTimersByTime(28 * 60_000 - 1);
    expect(warn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * 60_000);
    expect(expire).toHaveBeenCalledTimes(1);
    idle.stop();
  });
  it("meaningful activity resets the deadline", () => {
    const warn = vi.fn(), expire = vi.fn();
    const idle = new IdleSession(Date.now(), 30 * 60_000, 2 * 60_000, warn, expire);
    vi.advanceTimersByTime(20 * 60_000);
    idle.activity();
    vi.advanceTimersByTime(20 * 60_000);
    expect(warn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(8 * 60_000);
    expect(warn).toHaveBeenCalledTimes(1);
    idle.stop();
  });
  it("focus checks do not extend inactivity or repeat warnings", () => {
    const warn = vi.fn(), expire = vi.fn();
    const idle = new IdleSession(Date.now(), 30 * 60_000, 2 * 60_000, warn, expire);
    vi.advanceTimersByTime(28 * 60_000);
    idle.check(); idle.check();
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * 60_000);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it("expires immediately on returning from a sleeping tab", () => {
    const expire = vi.fn();
    const idle = new IdleSession(Date.now(), 30 * 60_000, 2 * 60_000, vi.fn(), expire);
    vi.setSystemTime(Date.now() + 31 * 60_000);
    idle.check();
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it("cleans up pending timers", () => {
    const warn = vi.fn();
    const idle = new IdleSession(Date.now(), 30 * 60_000, 2 * 60_000, warn, vi.fn());
    idle.stop(); vi.advanceTimersByTime(60 * 60_000);
    expect(warn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});