export function hasUnreadNotifications(count: number | undefined, failed = false): boolean {
  return !failed && typeof count === "number" && Number.isFinite(count) && count > 0;
}