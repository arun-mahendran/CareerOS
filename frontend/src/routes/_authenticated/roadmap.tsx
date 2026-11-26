import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Check, ChevronDown, CircleDot, Clock, ExternalLink, Flag, Hammer, Lock, PlayCircle, RotateCcw,
  Search, Settings2, SkipForward, Target, Timer, Wrench,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { profileQuery } from "@/lib/user-data";
import { ROLE_NAMES, findRoadmap, type ResourceKind } from "@/lib/roadmap/catalog";
import {
  DEFAULT_PREFS, buildPlan, logStudyTime, roadmapPrefsQuery, roadmapProgressQuery, savePrefs, setItemStatus,
  setTargetRole, studyLogsQuery, weekStart, type ItemStatus, type PlannedActivity, type PlannedPhase, type Prefs,
} from "@/lib/roadmap/service";
import { ROLE_REQUIREMENTS, analyze, gapFromLevels, userSkillsQuery } from "@/lib/skills/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({
    meta: [
      { title: "Career roadmap — CareerOS" },
      { name: "description", content: "Your personalized learning path built from your target role and skill gaps." },
      { property: "og:title", content: "Career roadmap — CareerOS" },
      { property: "og:description", content: "Your personalized learning path built from your target role and skill gaps." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: RoadmapPage,
});

type Filter = "all" | "in_progress" | "completed" | "not_started";
const STATUS_LABEL: Record<ItemStatus, string> = { not_started: "Not started", in_progress: "In progress", completed: "Completed", skipped: "Skipped" };
const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50";

function RoadmapPage() {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery);
  const progress = useQuery(roadmapProgressQuery);
  const prefsQ = useQuery(roadmapPrefsQuery);
  const logsQ = useQuery(studyLogsQuery);
  const prefs = prefsQ.data ?? DEFAULT_PREFS;

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const role = profile.data?.target_role ?? null;
  const rm = findRoadmap(role);
  const skillsQ = useQuery(userSkillsQuery);
  const reqs = rm ? ROLE_REQUIREMENTS[rm.role] ?? [] : [];
  const levels = useMemo(() => new Map((skillsQ.data ?? []).map((s) => [s.skill.toLowerCase(), s.level])), [skillsQ.data]);
  const gapOf = (skill?: string) => gapFromLevels(levels, reqs, skill);
  const plan = useMemo(() => (rm && progress.data ? buildPlan(rm, progress.data, prefs, logsQ.data ?? [], gapOf) : []), [rm, progress.data, prefs, logsQ.data, levels]);
  const all = plan.flatMap((p) => p.items);

  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: ItemStatus }) => setItemStatus(id, s),
    onSuccess: (_d, v) => { if (v.s === "completed") toast.success("Marked complete"); },
    onError: () => toast.error("Couldn't save your progress. Please try again."),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["roadmap_progress_full"] }); qc.invalidateQueries({ queryKey: ["roadmap_progress"] }); },
  });
  const log = useMutation({
    mutationFn: ({ id, m }: { id: string; m: number }) => logStudyTime(id, m),
    onSuccess: () => toast.success("Study time logged"),
    onError: () => toast.error("Couldn't log study time."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["roadmap_study_logs"] }),
  });

  if (profile.isLoading || progress.isLoading) return <LoadingState />;
  if (progress.isError) return <ErrorState onRetry={() => progress.refetch()} />;

  if (!role || !rm) {
    return (
      <>
        <Header role={null} onRole={() => setRoleOpen(true)} onCustom={() => setCustomOpen(true)} />
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <Target className="mx-auto size-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Choose a target role to build your personalized roadmap.</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {role ? `We don't have a roadmap for “${role}” yet. Pick the closest supported role.` : "Your roadmap is built from your target role and skill gaps."}
          </p>
          <button className={cn(btnPrimary, "mt-5")} onClick={() => setRoleOpen(true)}>Choose target role</button>
        </div>
        <RoleDialog open={roleOpen} onOpenChange={setRoleOpen} current={role} plan={plan} />
      </>
    );
  }

  // ---------- Metrics (all derived from saved data) ----------
  const required = all.filter((a) => a.status !== "skipped");
  const completed = required.filter((a) => a.status === "completed");
  const pct = required.length ? Math.round((completed.length / required.length) * 100) : 0;
  const totalMinutes = (logsQ.data ?? []).reduce((s, l) => s + l.minutes, 0);
  const remainingHours = required.filter((a) => a.status !== "completed").reduce((s, a) => s + a.hours, 0);
  const ws = weekStart();
  const weekMinutes = (logsQ.data ?? []).filter((l) => new Date(l.logged_on + "T00:00:00") >= ws).reduce((s, l) => s + l.minutes, 0);

  const phaseState = (p: PlannedPhase) => {
    const req = p.items.filter((i) => i.status !== "skipped");
    if (req.every((i) => i.status === "completed")) return "done" as const;
    return p === currentPhase ? ("current" as const) : ("upcoming" as const);
  };
  const currentPhase = plan.find((p) => p.items.some((i) => i.status !== "completed" && i.status !== "skipped"));
  const current =
    all.find((a) => a.status === "in_progress") ??
    currentPhase?.items.find((a) => a.status === "not_started" && !a.locked) ?? null;
  const topGaps = analyze(reqs, skillsQ.data ?? [], rm.role, "role").filter((a) => a.priority > 0).sort((a, b) => b.priority - a.priority).slice(0, 3);

  const matches = (a: PlannedActivity) =>
    (filter === "all" || (filter === "not_started" ? a.status === "not_started" : a.status === filter)) &&
    (!q || `${a.title} ${a.summary} ${a.concepts.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  const isCollapsed = (p: PlannedPhase) => (q || filter !== "all" ? false : collapsed[p.id] ?? phaseState(p) === "done");
  const setAll = (c: boolean) => setCollapsed(Object.fromEntries(plan.map((p) => [p.id, c])));
  const continueCurrent = () => {
    if (!current) return;
    const ph = plan.find((p) => p.items.includes(current));
    if (ph) setCollapsed((c) => ({ ...c, [ph.id]: false }));
    setOpenId(current.id);
  };

  const openItem = all.find((a) => a.id === openId) ?? null;

  return (
    <>
      <Header role={rm.role} onRole={() => setRoleOpen(true)} onCustom={() => setCustomOpen(true)} />

      {/* Summary */}
      <section className="mb-8 animate-rise">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Overall progress" value={`${pct}%`} hint={`${completed.length} of ${required.length} activities`} />
          <Stat label="Completed activities" value={`${completed.length} of ${required.length}`} hint={all.length - required.length ? `${all.length - required.length} skipped` : "Required activities"} />
          <Stat label="Learning time" value={fmtMinutes(totalMinutes)} hint="Actual time you logged" />
          <Stat label="Remaining effort" value={`~${remainingHours}h`} hint="Estimate, not a guarantee" />
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Roadmap completion">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-card p-0.5 text-sm">
              {(["all", "in_progress", "completed", "not_started"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2.5 py-1 transition", filter === f ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                  {f === "all" ? "All phases" : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
            <label className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics" className="h-8 w-full rounded-lg border bg-card pr-3 pl-8 text-sm outline-none focus:border-primary/40" />
            </label>
            <button className={cn(btn, "text-xs")} onClick={() => setAll(false)}>Expand all</button>
            <button className={cn(btn, "text-xs")} onClick={() => setAll(true)}>Collapse all</button>
          </div>

          {/* Timeline */}
          <div className="relative space-y-4 pl-8">
            <div className="absolute top-3 bottom-3 left-[11px] w-px bg-border" />
            {plan.map((p) => {
              const st = phaseState(p);
              const items = p.items.filter(matches);
              if ((q || filter !== "all") && !items.length) return null;
              const req = p.items.filter((i) => i.status !== "skipped");
              const doneN = req.filter((i) => i.status === "completed").length;
              const left = req.filter((i) => i.status !== "completed").reduce((s, i) => s + i.hours, 0);
              const c = isCollapsed(p);
              return (
                <section key={p.id} className="relative">
                  <span className={cn("absolute -left-8 top-4 grid size-6 place-items-center rounded-full border-2 bg-background",
                    st === "done" ? "border-success bg-success text-primary-foreground" : st === "current" ? "border-primary" : "border-border")}>
                    {st === "done" ? <Check className="size-3" /> : st === "current" ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  <div className={cn("rounded-2xl border bg-card shadow-soft transition", st === "current" && "border-primary/30")}>
                    <button onClick={() => setCollapsed((x) => ({ ...x, [p.id]: !c }))} className="flex w-full items-start gap-4 p-5 text-left" aria-expanded={!c}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground">
                          PHASE {String(p.index).padStart(2, "0")}
                          {st === "current" && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-primary">Current</span>}
                          {st === "done" && <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-success">Completed</span>}
                        </p>
                        <h2 className="mt-1 text-base font-semibold">{p.title}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{doneN} of {req.length} activities completed</span>
                          <span>{left ? `~${left}h remaining` : "Nothing remaining"}</span>
                        </div>
                        <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${req.length ? (100 * doneN) / req.length : 100}%` }} />
                        </div>
                      </div>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", !c && "rotate-180")} />
                    </button>
                    {!c && (
                      <div className="space-y-2 border-t p-3 sm:p-4">
                        {items.map((a) => (
                          <ActivityCard key={a.id} a={a} busy={status.isPending} onOpen={() => setOpenId(a.id)}
                            onStatus={(s) => status.mutate({ id: a.id, s })} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel title="Current focus" icon={<CircleDot className="size-3.5" />}>
            {current ? (
              <>
                <p className="text-xs text-muted-foreground">Phase {String(plan.find((p) => p.items.includes(current))?.index ?? 0).padStart(2, "0")} · {plan.find((p) => p.items.includes(current))?.title}</p>
                <p className="mt-1 text-sm font-medium">{current.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">~{current.hours}h estimated</p>
                <button className={cn(btnPrimary, "mt-3 w-full justify-center")} onClick={continueCurrent}><PlayCircle className="size-3.5" /> Continue learning</button>
              </>
            ) : <p className="text-sm text-muted-foreground">{pct === 100 ? "You've finished every activity. Great work." : "Finish prerequisites to unlock the next activity."}</p>}
          </Panel>

          <Panel title="Next recommended action" icon={<Flag className="size-3.5" />}>
            <NextAction plan={plan} />
          </Panel>

          <Panel title="Skill gaps" icon={<Target className="size-3.5" />}>
            {topGaps.length ? (
              <ul className="space-y-2">
                {topGaps.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between text-sm">
                    <span>{s.skill}</span>
                    <span className="text-xs text-destructive">{s.status === "missing" ? "Missing" : "Improve"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Rate your skills on the Skill Gaps page to see gaps here.</p>}
            <Link to="/skills" className={cn(btn, "mt-3 w-full justify-center text-xs")}>View all skill gaps</Link>
          </Panel>

          <Panel title="Weekly goal" icon={<Timer className="size-3.5" />}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm"><span className="font-semibold">{fmtMinutes(weekMinutes)}</span> <span className="text-muted-foreground">of {prefs.weekly_hours}h</span></p>
              <button className="text-xs font-medium text-primary hover:underline" onClick={() => setCustomOpen(true)}>Edit</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (100 * weekMinutes) / (prefs.weekly_hours * 60))}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {weekMinutes >= prefs.weekly_hours * 60 ? "Goal reached this week." : `${fmtMinutes(prefs.weekly_hours * 60 - weekMinutes)} left this week. Log time from any activity.`}
            </p>
            {remainingHours > 0 && <p className="mt-2 text-xs text-muted-foreground">At this pace, roughly {Math.ceil(remainingHours / prefs.weekly_hours)} weeks to finish — a guide, not a promise.</p>}
          </Panel>
        </aside>
      </div>

      <ActivitySheet a={openItem} onClose={() => setOpenId(null)} busy={status.isPending || log.isPending}
        onStatus={(s) => openItem && status.mutate({ id: openItem.id, s })}
        onLog={(m) => openItem && log.mutate({ id: openItem.id, m })} />
      <RoleDialog open={roleOpen} onOpenChange={setRoleOpen} current={rm.role} plan={plan} />
      <CustomizeDialog open={customOpen} onOpenChange={setCustomOpen} prefs={prefs} role={rm.role} plan={plan} gapOf={gapOf} onRole={() => { setCustomOpen(false); setRoleOpen(true); }} />
    </>
  );
}

// ---------- Pieces ----------

function Header({ role, onRole, onCustom }: { role: string | null; onRole: () => void; onCustom: () => void }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <p className="eyebrow">Your career roadmap</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{role ? `${role} Roadmap` : "Your Roadmap"}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">A personalized learning path built from your target role, current skills, and identified skill gaps.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={onRole}><Target className="size-3.5" /> Change target role</button>
        <button className={btn} onClick={onCustom}><Settings2 className="size-3.5" /> Customize roadmap</button>
        <Link to="/skills" className={btnPrimary}>View skill gaps</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{icon}{title}</p>
      {children}
    </div>
  );
}

function GapBadge({ a }: { a: PlannedActivity }) {
  if (a.priority) return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Priority</span>;
  if (a.gap === "missing") return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Skill gap</span>;
  if (a.gap === "partial") return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-foreground">Improve</span>;
  if (a.gap === "strong") return <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">You know this · review or skip</span>;
  return null;
}

function StatusIcon({ s, locked }: { s: ItemStatus; locked: boolean }) {
  if (locked) return <span className="grid size-5 shrink-0 place-items-center rounded-md border text-muted-foreground"><Lock className="size-3" /></span>;
  if (s === "completed") return <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Check className="size-3" /></span>;
  if (s === "in_progress") return <span className="grid size-5 shrink-0 place-items-center rounded-md border-2 border-primary"><span className="size-1.5 rounded-full bg-primary" /></span>;
  if (s === "skipped") return <span className="grid size-5 shrink-0 place-items-center rounded-md border text-muted-foreground"><SkipForward className="size-3" /></span>;
  return <span className="size-5 shrink-0 rounded-md border" />;
}

function ActivityCard({ a, onOpen, onStatus, busy }: { a: PlannedActivity; onOpen: () => void; onStatus: (s: ItemStatus) => void; busy: boolean }) {
  const done = a.status === "completed" || a.status === "skipped";
  return (
    <div className={cn("group rounded-xl border bg-background p-4 transition hover:border-primary/30 hover:shadow-soft", done && "opacity-70")}>
      <div className="flex items-start gap-3">
        <StatusIcon s={a.status} locked={a.locked} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className={cn("text-left text-sm font-medium hover:text-primary", a.status === "completed" && "line-through")}>{a.title}</button>
            <GapBadge a={a} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{a.difficulty}</span><span>·</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" />{a.hours}h</span><span>·</span>
            <span className={cn(a.status === "in_progress" && "font-medium text-primary", a.status === "completed" && "text-success")}>{STATUS_LABEL[a.status]}</span>
            {a.locked && <span>· Unlocks after {a.blockers.join(", ")}</span>}
          </div>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          {a.status === "not_started" && !a.locked && <button disabled={busy} className={cn(btn, "text-xs")} onClick={() => onStatus("in_progress")}>Start</button>}
          {a.status === "in_progress" && <button className={cn(btnPrimary, "text-xs")} onClick={onOpen}>Continue learning</button>}
          <button className={cn(btn, "text-xs")} onClick={onOpen}>Details</button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 sm:hidden">
        {a.status === "not_started" && !a.locked && <button disabled={busy} className={cn(btn, "text-xs")} onClick={() => onStatus("in_progress")}>Start</button>}
        <button className={cn(a.status === "in_progress" ? btnPrimary : btn, "text-xs")} onClick={onOpen}>{a.status === "in_progress" ? "Continue learning" : "Details"}</button>
      </div>
    </div>
  );
}

const KIND_ICON: Record<ResourceKind, typeof BookOpen> = { Read: BookOpen, Watch: PlayCircle, Practice: Wrench, Build: Hammer };

function ActivitySheet({ a, onClose, onStatus, onLog, busy }: { a: PlannedActivity | null; onClose: () => void; onStatus: (s: ItemStatus) => void; onLog: (m: number) => void; busy: boolean }) {
  const [mins, setMins] = useState("30");
  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {a && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{a.difficulty}</span><span>·</span><span>~{a.hours}h</span><span>·</span><span>{STATUS_LABEL[a.status]}</span><GapBadge a={a} />
              </div>
              <SheetTitle className="text-xl">{a.title}</SheetTitle>
              <SheetDescription>{a.summary}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6 text-sm">
              {a.locked && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">Complete {a.blockers.join(", ")} first — this activity builds on it.</p>
              )}
              <Block title="Learning objectives" items={a.objectives} />
              <Block title="Concepts to learn" items={a.concepts} />
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Learning resources</h3>
                {a.resources.length ? (
                  <ul className="space-y-1.5">
                    {a.resources.map((r) => {
                      const I = KIND_ICON[r.kind];
                      return (
                        <li key={r.url}>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-2.5 transition hover:border-primary/30 hover:bg-muted/50">
                            <I className="size-4 text-primary" />
                            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.title}</span><span className="text-xs text-muted-foreground">{r.kind} · {r.provider}</span></span>
                            <ExternalLink className="size-3.5 text-muted-foreground" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No verified resources for this activity yet. Use the objectives and practice tasks above as your guide.</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">Opening a resource doesn't mark the topic complete.</p>
              </section>
              <Block title="Practice tasks" items={a.practice} />
              {a.project && <Block title="Hands-on project" items={[a.project]} />}
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Assessment</h3>
                <p className="text-xs text-muted-foreground">Quizzes for this topic aren't available yet. Use the completion criteria below as your self-check.</p>
              </section>
              <Block title="Completion criteria" items={a.criteria} check />

              <section className="rounded-xl border bg-muted/30 p-3">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Log study time</h3>
                <div className="flex gap-2">
                  <select value={mins} onChange={(e) => setMins(e.target.value)} className="h-8 rounded-lg border bg-card px-2 text-sm">
                    {["15", "30", "45", "60", "90", "120"].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                  <button disabled={busy} className={cn(btn, "text-xs")} onClick={() => onLog(Number(mins))}><Clock className="size-3.5" /> Log time</button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Logged so far: {fmtMinutes(a.minutes)}</p>
              </section>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                {a.status === "not_started" && !a.locked && <button disabled={busy} className={btnPrimary} onClick={() => onStatus("in_progress")}><PlayCircle className="size-3.5" /> Start learning</button>}
                {a.status !== "completed" && !a.locked && <button disabled={busy} className={a.status === "in_progress" ? btnPrimary : btn} onClick={() => onStatus("completed")}><Check className="size-3.5" /> Mark complete</button>}
                {a.status === "not_started" && <button disabled={busy} className={btn} onClick={() => onStatus("skipped")}><SkipForward className="size-3.5" /> Skip — I already know this</button>}
                {a.status !== "not_started" && <button disabled={busy} className={btn} onClick={() => onStatus("not_started")}><RotateCcw className="size-3.5" /> Reset</button>}
              </div>
              {a.completedAt && <p className="text-xs text-muted-foreground">Completed on {new Date(a.completedAt).toLocaleDateString()}.</p>}
              {a.status === "completed" && (
                <p className="text-xs text-muted-foreground">Finished something worth showing? <Link to="/resumes" className="font-medium text-primary hover:underline">Review your resume</Link> and decide whether to add it.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Block({ title, items, check }: { title: string; items: string[]; check?: boolean }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2">
            {check ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />}
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextAction({ plan }: { plan: PlannedPhase[] }) {
  const all = plan.flatMap((p) => p.items);
  const locked = all.find((a) => a.locked);
  const gap = all.find((a) => a.status === "not_started" && !a.locked && (a.gap === "missing" || a.priority));
  if (gap) return <p className="text-sm"><span className="font-medium">{gap.title}</span> <span className="text-muted-foreground">closes one of your biggest skill gaps{gap.prereqs?.length ? " and its prerequisites are done" : ""}.</span></p>;
  if (locked) return <p className="text-sm text-muted-foreground">Complete <span className="font-medium text-foreground">{locked.blockers[0]}</span> before starting <span className="font-medium text-foreground">{locked.title}</span>.</p>;
  const next = all.find((a) => a.status === "not_started");
  return next ? <p className="text-sm">Start <span className="font-medium">{next.title}</span>.</p> : <p className="text-sm text-muted-foreground">Nothing pending — head to <Link to="/interviews" className="font-medium text-primary hover:underline">Interview prep</Link>.</p>;
}

function RoleDialog({ open, onOpenChange, current, plan }: { open: boolean; onOpenChange: (o: boolean) => void; current: string | null; plan: PlannedPhase[] }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState<string>(current ?? ROLE_NAMES[0]!);
  const m = useMutation({
    mutationFn: () => setTargetRole(pick),
    onSuccess: () => { toast.success(`Roadmap rebuilt for ${pick}`); qc.invalidateQueries({ queryKey: ["profile"] }); onOpenChange(false); },
    onError: () => toast.error("Couldn't update your target role."),
  });
  const next = findRoadmap(pick);
  const nextIds = new Set(next?.phases.flatMap((p) => p.activities) ?? []);
  const doneIds = plan.flatMap((p) => p.items).filter((i) => i.status !== "not_started").map((i) => i.id);
  const kept = doneIds.filter((id) => nextIds.has(id)).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change target role</DialogTitle>
          <DialogDescription>Your roadmap is rebuilt for the role you choose. This also updates the target role on your profile.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_NAMES.map((r) => (
            <button key={r} onClick={() => setPick(r)} className={cn("rounded-lg border px-3 py-2 text-left text-sm transition", pick === r ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted")}>{r}</button>
          ))}
        </div>
        {current && pick !== current && (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Your progress is never deleted. {doneIds.length ? `${kept} of ${doneIds.length} started or finished activities also appear in the new roadmap and carry over.` : ""} Switching back restores your current roadmap as it is.
          </p>
        )}
        <DialogFooter>
          <button className={btn} onClick={() => onOpenChange(false)}>Cancel</button>
          <button className={btnPrimary} disabled={m.isPending || pick === current} onClick={() => m.mutate()}>Build roadmap</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomizeDialog({ open, onOpenChange, prefs, role, plan, onRole, gapOf }: { open: boolean; onOpenChange: (o: boolean) => void; prefs: Prefs; role: string; plan: PlannedPhase[]; onRole: () => void; gapOf: (s?: string) => "missing" | "partial" | "strong" | null }) {
  const qc = useQueryClient();
  const [p, setP] = useState<Prefs>(prefs);
  const skills = Array.from(new Set(plan.flatMap((x) => x.items).map((i) => i.skill).filter(Boolean) as string[]));
  const m = useMutation({
    mutationFn: () => savePrefs(p),
    onSuccess: () => { toast.success("Preferences saved"); qc.invalidateQueries({ queryKey: ["roadmap_prefs"] }); onOpenChange(false); },
    onError: () => toast.error("Couldn't save your preferences."),
  });
  const field = "h-9 w-full rounded-lg border bg-card px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setP(prefs); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize roadmap</DialogTitle>
          <DialogDescription>Tune the order and workload. Time estimates are guidance, not guarantees.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Target role: <span className="font-medium">{role}</span></span>
            <button className="text-xs font-medium text-primary hover:underline" onClick={onRole}>Change</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Weekly study hours</span>
              <input type="number" min={1} max={60} value={p.weekly_hours} onChange={(e) => setP({ ...p, weekly_hours: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} className={field} /></label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Learning pace</span>
              <select value={p.pace} onChange={(e) => { const pace = e.target.value as Prefs["pace"]; setP({ ...p, pace, weekly_hours: pace === "relaxed" ? 4 : pace === "steady" ? 8 : 15 }); }} className={field}>
                <option value="relaxed">Relaxed (~4h/week)</option><option value="steady">Steady (~8h/week)</option><option value="intensive">Intensive (~15h/week)</option>
              </select></label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Current level</span>
              <select value={p.skill_level} onChange={(e) => setP({ ...p, skill_level: e.target.value as Prefs["skill_level"] })} className={field}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select></label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Target date (optional)</span>
              <input type="date" value={p.target_date ?? ""} onChange={(e) => setP({ ...p, target_date: e.target.value || null })} className={field} /></label>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Priority skills — moved to the front of each phase</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const on = p.priority_skills.includes(s);
                const g = gapOf(s);
                return (
                  <button key={s} onClick={() => setP({ ...p, priority_skills: on ? p.priority_skills.filter((x) => x !== s) : [...p.priority_skills, s] })}
                    className={cn("rounded-full border px-2.5 py-1 text-xs transition", on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                    {s}{g === "missing" ? " · gap" : ""}
                  </button>
                );
              })}
            </div>
          </div>
          {p.target_date && (
            <p className="text-xs text-muted-foreground">
              {(() => {
                const left = plan.flatMap((x) => x.items).filter((i) => i.status !== "completed" && i.status !== "skipped").reduce((s, i) => s + i.hours, 0);
                const weeks = Math.max(0, (new Date(p.target_date).getTime() - Date.now()) / 6048e5);
                const need = weeks ? Math.ceil(left / weeks) : left;
                return `To finish ~${left}h by then you'd need about ${need}h per week. This is an estimate.`;
              })()}
            </p>
          )}
        </div>
        <DialogFooter>
          <button className={btn} onClick={() => onOpenChange(false)}>Cancel</button>
          <button className={btnPrimary} disabled={m.isPending} onClick={() => m.mutate()}>Save preferences</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-2/3" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
      <p className="font-medium">We couldn't load your roadmap.</p>
      <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
      <button className={cn(btn, "mt-4")} onClick={onRetry}><RotateCcw className="size-3.5" /> Retry</button>
    </div>
  );
}

function fmtMinutes(m: number) {
  if (!m) return "0h";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}
