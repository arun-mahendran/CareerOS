import { describe, expect, it } from "vitest";
import { hasUnreadNotifications } from "@/lib/notification-state";

describe("unread indicator", () => {
  it("hides for zero unread", () => expect(hasUnreadNotifications(0)).toBe(false));
  it("shows for one unread", () => expect(hasUnreadNotifications(1)).toBe(true));
  it("shows for multiple unread", () => expect(hasUnreadNotifications(3)).toBe(true));
  it("hides while count is unknown", () => expect(hasUnreadNotifications(undefined)).toBe(false));
  it("hides on a failed request even with stale data", () => expect(hasUnreadNotifications(1, true)).toBe(false));
  it("reflects final read and a new notification", () => {
    expect([1, 0, 1].map((count) => hasUnreadNotifications(count))).toEqual([true, false, true]);
  });
});