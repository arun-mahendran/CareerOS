import { queryOptions } from "@tanstack/react-query";
import { calendarEvents, type CalendarEventRecord } from "@/services/backend";

export type CalView = "month" | "week" | "day" | "agenda";

export const CATEGORIES = [
  { value: "INTERVIEW", label: "Interview", tone: "primary" },
  { value: "ASSESSMENT", label: "Assessment", tone: "chart-2" },
  { value: "APPLICATION_DEADLINE", label: "Application deadline", tone: "destructive" },
  { value: "PREPARATION", label: "Preparation", tone: "warning" },
  { value: "LEARNING", label: "Learning", tone: "success" },
  { value: "REMINDER", label: "Reminder", tone: "chart-4" },
  { value: "OTHER", label: "Other", tone: "muted-foreground" },
] as const;
// Older saved values stay readable under the closest current category.
const LEGACY: Record<string, string> = { PREP_TASK: "PREPARATION", ROADMAP_MILESTONE: "LEARNING", DEADLINE: "APPLICATION_DEADLINE" };
export const categoryOf = (type: string) =>
  CATEGORIES.find((c) => c.value === (LEGACY[type] ?? type)) ?? CATEGORIES[CATEGORIES.length - 1]!;

// ---------- local-date helpers (never go through UTC for calendar arithmetic)
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay()); // Sunday-first
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseKey = (k: string) => { const [y, m, dd] = k.split("-").map(Number); return new Date(y!, m! - 1, dd!); };

/** 42 cells (6 weeks) covering the month of `d`. */
export function monthGrid(d: Date): Date[] {
  const first = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function viewRange(view: CalView, d: Date): { start: Date; end: Date } {
  if (view === "month") { const g = monthGrid(d); return { start: g[0]!, end: addDays(g[41]!, 1) }; }
  if (view === "week") { const s = startOfWeek(d); return { start: s, end: addDays(s, 7) }; }
  if (view === "day") return { start: startOfDay(d), end: addDays(startOfDay(d), 1) };
  return { start: startOfDay(d), end: addMonths(startOfDay(d), 3) };
}

/**
 * All-day events are stored at UTC midnight of their calendar date so they never shift days;
 * timed events are real instants shown in the browser's timezone.
 */
export function eventLocalDay(e: Pick<CalendarEventRecord, "all_day" | "starts_at">): Date {
  const t = new Date(e.starts_at);
  return e.all_day ? new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) : startOfDay(t);
}
export function eventLocalEndDay(e: Pick<CalendarEventRecord, "all_day" | "starts_at" | "ends_at">): Date {
  if (!e.ends_at) return eventLocalDay(e);
  const t = new Date(e.ends_at);
  return e.all_day ? new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) : startOfDay(t);
}
export const occursOn = (e: CalendarEventRecord, d: Date) => {
  const s = +eventLocalDay(e), en = +eventLocalEndDay(e), x = +startOfDay(d);
  return x >= s && x <= en;
};
export const allDayIso = (key: string) => `${key}T00:00:00.000Z`;
export const localIso = (key: string, time: string) => { const d = parseKey(key); const [h, m] = time.split(":").map(Number); d.setHours(h!, m!, 0, 0); return d.toISOString(); };

export const sortEvents = (list: CalendarEventRecord[]) =>
  [...list].sort((a, b) => (a.all_day === b.all_day ? +new Date(a.starts_at) - +new Date(b.starts_at) : a.all_day ? -1 : 1));

/** Greedy column layout so overlapping timed events sit side by side. */
export function layoutOverlaps(list: CalendarEventRecord[]): Map<string, { col: number; cols: number }> {
  const timed = list.filter((e) => !e.all_day).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const out = new Map<string, { col: number; cols: number }>();
  let group: { e: CalendarEventRecord; col: number }[] = []; let groupEnd = -Infinity; let colEnds: number[] = [];
  const flush = () => { const cols = colEnds.length || 1; group.forEach((g) => out.set(g.e.id, { col: g.col, cols })); group = []; colEnds = []; };
  for (const e of timed) {
    const s = +new Date(e.starts_at); const en = e.ends_at ? +new Date(e.ends_at) : s + 30 * 60_000;
    if (s >= groupEnd) flush();
    let col = colEnds.findIndex((c) => c <= s);
    if (col === -1) { col = colEnds.length; colEnds.push(en); } else colEnds[col] = en;
    group.push({ e, col }); groupEnd = Math.max(groupEnd, en);
  }
  flush();
  return out;
}

export const calendarQuery = (start: Date, end: Date) => queryOptions({
  queryKey: ["calendar_events", start.toISOString(), end.toISOString()],
  // Fetch from one day earlier so multi-day and all-day (UTC-midnight) events overlapping the range are included.
  queryFn: () => calendarEvents.list(addDays(start, -1).toISOString(), end.toISOString()),
  staleTime: 30_000,
});
