import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock, BookOpen, Briefcase, CalendarDays, CalendarOff, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock, FileWarning, Hammer, MapPin, Pencil, Plus, RefreshCw, Trash2, type LucideIcon, CircleDot,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { applicationsQuery } from "@/lib/applications";
import {
  addDays, addMonths, allDayIso, calendarQuery, CATEGORIES, categoryOf, dateKey, eventLocalDay, layoutOverlaps,
  localIso, monthGrid, occursOn, sameDay, sortEvents, startOfDay, startOfWeek, viewRange, type CalView,
} from "@/lib/calendar";
import { calendarEvents, type CalendarEventInput, type CalendarEventRecord } from "@/services/backend";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — CareerOS" }, { name: "description", content: "Plan your interviews, deadlines, and career activities." }, { property: "og:title", content: "Calendar — CareerOS" }, { property: "og:description", content: "Plan your interviews, deadlines, and career activities." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: CalendarPage,
});

const ICONS: Record<string, LucideIcon> = {
  INTERVIEW: Briefcase, ASSESSMENT: ClipboardCheck, APPLICATION_DEADLINE: FileWarning, PREPARATION: Hammer,
  LEARNING: BookOpen, REMINDER: AlarmClock, OTHER: CircleDot,
};
const TONE: Record<string, string> = {
  primary: "border-l-primary bg-primary/10 [--dot:var(--primary)]",
  "chart-2": "border-l-chart-2 bg-chart-2/12 [--dot:var(--chart-2)]",
  destructive: "border-l-destructive bg-destructive/10 [--dot:var(--destructive)]",
  warning: "border-l-warning bg-warning/15 [--dot:var(--warning)]",
  success: "border-l-success bg-success/12 [--dot:var(--success)]",
  "chart-4": "border-l-chart-4 bg-chart-4/12 [--dot:var(--chart-4)]",
  "muted-foreground": "border-l-muted-foreground bg-muted [--dot:var(--muted-foreground)]",
};
const VIEWS: CalView[] = ["month", "week", "day", "agenda"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_PX = 48;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const timeLabel = (e: CalendarEventRecord) => e.all_day ? "All day" : e.ends_at ? `${fmtTime(e.starts_at)} – ${fmtTime(e.ends_at)}` : fmtTime(e.starts_at);
const duration = (e: CalendarEventRecord) => {
  if (e.all_day || !e.ends_at) return null;
  const m = Math.round((+new Date(e.ends_at) - +new Date(e.starts_at)) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
};

function CalendarPage() {
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [editing, setEditing] = useState<{ event?: CalendarEventRecord; day: Date } | null>(null);
  const [detail, setDetail] = useState<CalendarEventRecord | null>(null);
  const [today, setToday] = useState(() => startOfDay(new Date()));

  // keep "today" correct if the page stays open past midnight
  useEffect(() => { const id = window.setInterval(() => setToday(startOfDay(new Date())), 60_000); return () => window.clearInterval(id); }, []);

  const { start, end } = useMemo(() => viewRange(view, cursor), [view, cursor]);
  const q = useQuery(calendarQuery(start, end));
  const events = useMemo(() => sortEvents(q.data ?? []), [q.data]);

  const step = (dir: 1 | -1) => {
    const next = view === "month" ? addMonths(cursor, dir) : view === "week" ? addDays(cursor, 7 * dir) : view === "day" ? addDays(cursor, dir) : addMonths(cursor, dir);
    setCursor(next); setSelected(next);
  };
  const goToday = () => { setCursor(today); setSelected(today); };
  const pick = (d: Date) => { setSelected(d); if (view !== "month") setCursor(d); };

  const title = view === "day"
    ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "week"
      ? weekTitle(startOfWeek(cursor))
      : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Calendar" sub="Plan your interviews, deadlines, and career activities."
        right={<button onClick={() => setEditing({ day: selected })} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-4 w-4" /> Create event</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={goToday} className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Today</button>
        <div className="flex">
          <button aria-label="Previous" onClick={() => step(-1)} className="rounded-l-lg border bg-card p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next" onClick={() => step(1)} className="-ml-px rounded-r-lg border bg-card p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h2 className="ml-1 text-lg font-semibold" aria-live="polite">{title}</h2>
        {q.isFetching && !q.isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" />}
        <div role="tablist" aria-label="Calendar view" className="ml-auto flex rounded-lg border bg-card p-0.5">
          {VIEWS.map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setCursor(selected); }}
              className={cn("rounded-md px-3 py-1 text-sm capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{v}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {q.isError ? (
            <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
              <CalendarOff className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-3 font-medium">We couldn't load your events.</p>
              <p className="mt-1 text-sm text-muted-foreground">{(q.error as Error).message}</p>
              <button onClick={() => q.refetch()} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Try again</button>
            </div>
          ) : q.isLoading ? (
            <Skeleton className="h-[560px] w-full rounded-2xl" />
          ) : view === "month" ? (
            <MonthView cursor={cursor} selected={selected} today={today} events={events} onPick={pick} onOpen={setDetail}
              onMore={(d) => { setSelected(d); setCursor(d); setView("day"); }} />
          ) : view === "week" ? (
            <TimeGrid days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))} today={today} selected={selected} events={events} onOpen={setDetail} onPick={pick} />
          ) : view === "day" ? (
            <DayView day={cursor} today={today} events={events} onOpen={setDetail} onCreate={() => setEditing({ day: cursor })} />
          ) : (
            <AgendaView events={events} today={today} onOpen={setDetail} onCreate={() => setEditing({ day: selected })} />
          )}
        </div>

        <aside className="space-y-4">
          <SelectedDay day={selected} events={events.filter((e) => occursOn(e, selected))} onOpen={setDetail} onCreate={() => setEditing({ day: selected })} />
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="eyebrow">Categories</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
              {CATEGORIES.map((c) => { const I = ICONS[c.value]!; return <li key={c.value} className="flex items-center gap-2 text-sm"><span className={cn("grid h-6 w-6 place-items-center rounded-md border-l-[3px]", TONE[c.tone])}><I className="h-3.5 w-3.5" /></span>{c.label}</li>; })}
            </ul>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="eyebrow">Google Calendar</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Not connected</p>
            <p className="mt-1 text-xs text-muted-foreground">Sync isn't available yet. Events you create here are saved to your CareerOS account only.</p>
          </section>
        </aside>
      </div>

      {editing && <EventDialog key={editing.event?.id ?? "new"} initial={editing.event} day={editing.day} onClose={() => setEditing(null)}
        onSaved={(e) => { setEditing(null); const d = eventLocalDay(e); setSelected(d); if (view !== "agenda") setCursor(d); }} />}
      {detail && <EventDetails event={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing({ event: detail, day: eventLocalDay(detail) }); setDetail(null); }} />}
    </>
  );
}

function weekTitle(s: Date) {
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" })}`;
}

function Chip({ e, onOpen, compact }: { e: CalendarEventRecord; onOpen: (e: CalendarEventRecord) => void; compact?: boolean }) {
  const c = categoryOf(e.type); const I = ICONS[c.value]!;
  return (
    <button onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} title={`${c.label}: ${e.title}`}
      className={cn("flex w-full min-w-0 items-center gap-1.5 rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs text-foreground transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", TONE[c.tone])}>
      <I className="h-3 w-3 shrink-0" aria-label={c.label} />
      {!compact && !e.all_day && <span className="shrink-0 tabular-nums text-muted-foreground">{fmtTime(e.starts_at)}</span>}
      <span className="truncate font-medium">{e.title}</span>
    </button>
  );
}

function MonthView({ cursor, selected, today, events, onPick, onOpen, onMore }: {
  cursor: Date; selected: Date; today: Date; events: CalendarEventRecord[];
  onPick: (d: Date) => void; onOpen: (e: CalendarEventRecord) => void; onMore: (d: Date) => void;
}) {
  const grid = monthGrid(cursor);
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (ev: React.KeyboardEvent, d: Date) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (delta === undefined) return;
    ev.preventDefault(); const n = addDays(d, delta); onPick(n);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-day="${dateKey(n)}"]`)?.focus());
  };
  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{w}</div>)}
      </div>
      <div className="grid grid-cols-7" role="grid">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const list = events.filter((e) => occursOn(e, d));
          const isSel = sameDay(d, selected); const isToday = sameDay(d, today);
          return (
            <div key={i} role="gridcell" tabIndex={isSel ? 0 : -1} data-day={dateKey(d)} aria-selected={isSel}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${list.length} event${list.length === 1 ? "" : "s"}`}
              onClick={() => onPick(d)} onKeyDown={(ev) => { onKey(ev, d); if (ev.key === "Enter") onPick(d); }}
              className={cn("min-h-[64px] cursor-pointer border-b border-r p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-[104px] sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground", isSel ? "bg-accent/60" : "hover:bg-accent/30")}>
              <div className="flex items-center justify-between">
                <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-medium tabular-nums",
                  isToday && "bg-primary text-primary-foreground", isSel && !isToday && "ring-2 ring-primary")}>{d.getDate()}</span>
                {list.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary sm:hidden" aria-hidden />}
              </div>
              <div className="mt-1 hidden space-y-0.5 sm:block">
                {list.slice(0, 3).map((e) => <Chip key={e.id} e={e} onOpen={onOpen} />)}
                {list.length > 3 && <button onClick={(ev) => { ev.stopPropagation(); onMore(d); }} className="px-1.5 text-xs font-medium text-primary hover:underline">+{list.length - 3} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ days, today, selected, events, onOpen, onPick }: {
  days: Date[]; today: Date; selected?: Date; events: CalendarEventRecord[];
  onOpen: (e: CalendarEventRecord) => void; onPick?: (d: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = HOUR_PX * 7; }, []);
  const cols = `56px repeat(${days.length}, minmax(${days.length > 1 ? 88 : 0}px, 1fr))`;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <div className={days.length > 1 ? "min-w-[680px]" : ""}>
        <div className="grid border-b bg-muted/40" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <button key={+d} onClick={() => onPick?.(d)} className={cn("border-l px-2 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected && sameDay(d, selected) && "bg-accent/60")}>
              <span className="block text-xs uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</span>
              <span className={cn("mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums", sameDay(d, today) && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
            </button>
          ))}
        </div>
        <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
          <div className="px-1 py-1.5 text-right text-[10px] uppercase text-muted-foreground">All day</div>
          {days.map((d) => <div key={+d} className="space-y-0.5 border-l p-1">{events.filter((e) => e.all_day && occursOn(e, d)).map((e) => <Chip key={e.id} e={e} onOpen={onOpen} compact />)}</div>)}
        </div>
        <div ref={scroller} className="max-h-[560px] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: cols, height: HOUR_PX * 24 }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: h * HOUR_PX }}>{h === 0 ? "" : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" })}</span>)}
            </div>
            {days.map((d) => {
              const list = events.filter((e) => !e.all_day && sameDay(new Date(e.starts_at), d));
              const lay = layoutOverlaps(list);
              return (
                <div key={+d} className="relative border-l" style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_PX}px)` }}>
                  {sameDay(d, today) && <NowLine />}
                  {list.map((e) => {
                    const s = new Date(e.starts_at); const top = (s.getHours() + s.getMinutes() / 60) * HOUR_PX;
                    const endT = e.ends_at ? new Date(e.ends_at) : new Date(+s + 30 * 60_000);
                    const endH = sameDay(endT, d) ? endT.getHours() + endT.getMinutes() / 60 : 24;
                    const h = Math.max(22, (endH - (s.getHours() + s.getMinutes() / 60)) * HOUR_PX - 2);
                    const { col, cols: n } = lay.get(e.id) ?? { col: 0, cols: 1 };
                    const c = categoryOf(e.type); const I = ICONS[c.value]!;
                    return (
                      <button key={e.id} onClick={() => onOpen(e)} title={`${c.label}: ${e.title}`}
                        className={cn("absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs text-foreground shadow-soft transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", TONE[c.tone])}
                        style={{ top, height: h, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}>
                        <span className="flex items-center gap-1 font-medium"><I className="h-3 w-3 shrink-0" aria-label={c.label} /><span className="truncate">{e.title}</span></span>
                        {h > 34 && <span className="block truncate text-muted-foreground">{timeLabel(e)}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NowLine() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id); }, []);
  return <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR_PX }} aria-hidden />;
}

function DayView({ day, today, events, onOpen, onCreate }: { day: Date; today: Date; events: CalendarEventRecord[]; onOpen: (e: CalendarEventRecord) => void; onCreate: () => void }) {
  const list = events.filter((e) => occursOn(e, day));
  if (list.length === 0) return <Empty text="No events scheduled for this date." onCreate={onCreate} />;
  return <TimeGrid days={[day]} today={today} events={events} onOpen={onOpen} />;
}

function AgendaView({ events, today, onOpen, onCreate }: { events: CalendarEventRecord[]; today: Date; onOpen: (e: CalendarEventRecord) => void; onCreate: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, CalendarEventRecord[]>();
    for (const e of events) { const d = eventLocalDay(e); if (d < today && !(e.ends_at && occursOn(e, today))) continue; const k = dateKey(d < today ? today : d); m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, today]);
  if (groups.length === 0) return <Empty text="No upcoming events in the next three months." onCreate={onCreate} />;
  return (
    <div className="divide-y rounded-2xl border bg-card shadow-soft">
      {groups.map(([k, list]) => {
        const d = new Date(k + "T00:00:00");
        return (
          <section key={k} className="grid gap-3 p-4 sm:grid-cols-[140px_1fr]">
            <div>
              <p className={cn("text-sm font-semibold", sameDay(d, today) && "text-primary")}>{sameDay(d, today) ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" })}</p>
              <p className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
            <ul className="space-y-2">{list.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function EventRow({ e, onOpen }: { e: CalendarEventRecord; onOpen: (e: CalendarEventRecord) => void }) {
  const c = categoryOf(e.type); const I = ICONS[c.value]!; const dur = duration(e);
  return (
    <li>
      <button onClick={() => onOpen(e)} className={cn("flex w-full items-start gap-3 rounded-lg border-l-[3px] px-3 py-2 text-left transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", TONE[c.tone])}>
        <I className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <span className="block text-xs text-muted-foreground">{c.label} · {timeLabel(e)}{dur ? ` · ${dur}` : ""}{e.location ? ` · ${e.location}` : ""}</span>
          {e.notes && <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{e.notes}</span>}
        </span>
      </button>
    </li>
  );
}

function SelectedDay({ day, events, onOpen, onCreate }: { day: Date; events: CalendarEventRecord[]; onOpen: (e: CalendarEventRecord) => void; onCreate: () => void }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Selected date</p>
          <p className="mt-1 font-semibold">{day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <button aria-label="Add event on this date" onClick={onCreate} className="rounded-lg border p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-4 w-4" /></button>
      </div>
      {events.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No events scheduled for this date.</p>
        : <ul className="mt-3 space-y-2">{events.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} />)}</ul>}
    </section>
  );
}

function Empty({ text, onCreate }: { text: string; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-12 text-center shadow-soft">
      <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{text}</p>
      <button onClick={onCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Create event</button>
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

type Errs = { title?: string; startDate?: string; startTime?: string; end?: string };
const inputCls = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive";
const pad = (n: number) => String(n).padStart(2, "0");
const timeOf = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function EventDialog({ initial, day, onClose, onSaved }: { initial?: CalendarEventRecord | undefined; day: Date; onClose: () => void; onSaved: (e: CalendarEventRecord) => void }) {
  const qc = useQueryClient();
  const apps = useQuery(applicationsQuery);
  const [f, setF] = useState(() => {
    if (!initial) return { title: "", type: "INTERVIEW", allDay: false, startDate: dateKey(day), startTime: "09:00", endDate: dateKey(day), endTime: "10:00", notes: "", location: "", app: "" };
    const sd = eventLocalDay(initial);
    const ed = initial.ends_at ? (initial.all_day ? new Date(new Date(initial.ends_at).getUTCFullYear(), new Date(initial.ends_at).getUTCMonth(), new Date(initial.ends_at).getUTCDate()) : new Date(initial.ends_at)) : sd;
    return {
      title: initial.title, type: categoryOf(initial.type).value as string, allDay: initial.all_day,
      startDate: dateKey(sd), startTime: initial.all_day ? "09:00" : timeOf(initial.starts_at),
      endDate: dateKey(ed), endTime: initial.ends_at && !initial.all_day ? timeOf(initial.ends_at) : "",
      notes: initial.notes ?? "", location: initial.location ?? "", app: initial.application_id ?? "",
    };
  });
  const [errors, setErrors] = useState<Errs>({});
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (b: CalendarEventInput) => initial ? calendarEvents.update(initial.id, b) : calendarEvents.create(b),
    onSuccess: async (e) => { await qc.invalidateQueries({ queryKey: ["calendar_events"] }); toast.success(initial ? "Event updated" : "Event created"); onSaved(e); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save the event"),
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (save.isPending) return;
    const errs: Errs = {};
    if (!f.title.trim()) errs.title = "Event title is required.";
    if (!f.startDate) errs.startDate = "Start date is required.";
    if (!f.allDay && !f.startTime) errs.startTime = "Start time is required.";
    let starts = "", ends: string | null = null;
    if (!errs.startDate) {
      if (f.allDay) { starts = allDayIso(f.startDate); ends = f.endDate && f.endDate !== f.startDate ? allDayIso(f.endDate) : null; }
      else if (f.startTime) { starts = localIso(f.startDate, f.startTime); ends = f.endTime ? localIso(f.endDate || f.startDate, f.endTime) : null; }
      if (ends && starts && +new Date(ends) < +new Date(starts)) errs.end = f.allDay ? "End date can't be before the start date." : "End time can't be before the start time.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate({ title: f.title.trim(), type: f.type, all_day: f.allDay, starts_at: starts, ends_at: ends, notes: f.notes.trim() || null, location: f.location.trim() || null, application_id: f.app || null });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit event" : "Create event"}</DialogTitle>
          <DialogDescription>Add an interview, deadline or career activity to your calendar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Event title" error={errors.title}><input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} aria-invalid={!!errors.title} className={inputCls} placeholder="e.g. Technical interview with Acme" /></Field>
          <Field label="Category">
            <select value={f.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allDay} onChange={(e) => set("allDay", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />All-day event</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" error={errors.startDate}><input type="date" value={f.startDate} onChange={(e) => { set("startDate", e.target.value); if (!f.endDate || f.endDate < e.target.value) set("endDate", e.target.value); }} aria-invalid={!!errors.startDate} className={inputCls} /></Field>
            {!f.allDay && <Field label="Start time" error={errors.startTime}><input type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} aria-invalid={!!errors.startTime} className={inputCls} /></Field>}
            <Field label="End date (optional)"><input type="date" value={f.endDate} min={f.startDate} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!errors.end} className={inputCls} /></Field>
            {!f.allDay && <Field label="End time (optional)"><input type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} aria-invalid={!!errors.end} className={inputCls} /></Field>}
          </div>
          {errors.end && <p className="-mt-2 text-xs text-destructive" role="alert">{errors.end}</p>}
          <Field label="Location (optional)"><input value={f.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className={inputCls} placeholder="Office address or video link" /></Field>
          <Field label="Linked application (optional)">
            <select value={f.app} onChange={(e) => set("app", e.target.value)} className={inputCls} disabled={apps.isLoading}>
              <option value="">None</option>
              {(apps.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.title || "Untitled role"}{a.company ? ` — ${a.company}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Description (optional)"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls} /></Field>
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={save.isPending} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={save.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{save.isPending ? "Saving…" : initial ? "Save changes" : "Create event"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive" role="alert">{error}</span>}
    </label>
  );
}

function EventDetails({ event: e, onClose, onEdit }: { event: CalendarEventRecord; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const apps = useQuery(applicationsQuery);
  const [confirm, setConfirm] = useState(false);
  const c = categoryOf(e.type); const I = ICONS[c.value]!;
  const app = apps.data?.find((a) => a.id === e.application_id);
  const del = useMutation({
    mutationFn: () => calendarEvents.remove(e.id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["calendar_events"] }); toast.success("Event deleted"); setConfirm(false); onClose(); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete the event"),
  });
  const day = eventLocalDay(e);
  return (
    <>
      <Dialog open={!confirm} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-md border-l-[3px] px-2 py-0.5 text-xs font-medium", TONE[c.tone])}><I className="h-3.5 w-3.5" />{c.label}</span>
            <DialogTitle className="pt-1 text-xl">{e.title}</DialogTitle>
            <DialogDescription className="sr-only">Event details</DialogDescription>
          </DialogHeader>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-3"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" /><dd>{day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</dd></div>
            <div className="flex gap-3"><Clock className="h-4 w-4 shrink-0 text-muted-foreground" /><dd>{timeLabel(e)}{duration(e) ? ` (${duration(e)})` : ""}</dd></div>
            {e.location && <div className="flex gap-3"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground" /><dd className="break-words">{e.location}</dd></div>}
            {e.application_id && <div className="flex gap-3"><Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" /><dd>{app ? `${app.title}${app.company ? ` — ${app.company}` : ""}` : "Linked application"}</dd></div>}
            {e.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-muted-foreground">{e.notes}</p>}
          </dl>
          <DialogFooter className="gap-2 sm:justify-between">
            <button onClick={() => setConfirm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Delete</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Close</button>
              <button onClick={onEdit} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Pencil className="h-4 w-4" />Edit</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={(o) => !o && !del.isPending && setConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>"{e.title}" will be removed from your calendar. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={del.isPending} onClick={(ev) => { ev.preventDefault(); del.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{del.isPending ? "Deleting…" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
