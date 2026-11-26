const minutes = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const timeout = minutes(import.meta.env['VITE_SESSION_TIMEOUT_MINUTES'], 30);
const warning = Math.min(minutes(import.meta.env['VITE_SESSION_WARNING_MINUTES'], 2), timeout);
export const SESSION_CONFIG = {
  timeoutMs: timeout * 60_000,
  warningMs: warning * 60_000,
  activityThrottleMs: 1_000,
};