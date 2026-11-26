import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Briefcase, ChevronDown, ClipboardCheck, ExternalLink, Info, Map as MapIcon, Plus, Target } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { profileQuery } from "@/lib/user-data";
import { jobCatalogQuery } from "@/lib/job-catalog";
import { ROLE_NAMES, findRoadmap } from "@/lib/roadmap/catalog";
import { addPrioritySkills, roadmapPrefsQuery, setTargetRole } from "@/lib/roadmap/service";
import {
  CATEGORY_ORDER, LEVELS, SOURCE_LABEL, STATUS_LABEL, analyze, readiness, requirementsFor, saveSkillLevels, userSkillsQuery,
  type Analyzed, type Status,
} from "@/lib/skills/model";
import { cn } from "@/lib/utils";

type Search = { job?: string };

export const Route = createFileRoute("/_authenticated/skills")({
  validateSearch: (s: Record<string, unknown>): Search => (typeof s["job"] === "string" ? { job: s["job"] } : {}),
  head: () => ({
    meta: [
      { title: "Skill gap analysis — CareerOS" },
      { name: "description", content: "Compare your skills with your target role or a specific job and see what to focus on." },
      { property: "og:title", content: "Skill gap analysis — CareerOS" },
      { property: "og:description", content: "Compare your skills with your target role or a specific job and see what to focus on." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Skills,
});

const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50";

const TONE: Record<Status, { text: string; bg: string; bar: string }> = {
  on_target: { text: "text-success", bg: "bg-success/10", bar: "bg-success" },
  improve: { text: "text-foreground", bg: "bg-warning/15", bar: "bg-warning" },
  missing: { text: "text-destructive", bg: "bg-destructive/10", bar: "bg-destructive" },
  not_assessed: { text: "text-muted-foreground", bg: "bg-muted", bar: "bg-muted-foreground/40" },
};

function Skills() {
  const qc = useQueryClient();
  const nav = useNavigate({ from: "/skills" });
  const { job: jobId } = Route.useSearch();
  const profile = useQuery(profileQuery);
  const skillsQ = useQuery(userSkillsQuery);
  const prefsQ = useQuery(roadmapPrefsQuery);
  const catalog = useQuery(jobCatalogQuery);
  const jobs = catalog.data?.jobs ?? [];
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [assessOpen, setAssessOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const rm = findRoadmap(profile.data?.target_role);
  const job = jobId ? jobs.find((j) => j.id === jobId) ?? null : null;
  const { mode, reqs, source } = requirementsFor(rm?.role, job);
  const items = useMemo(() => analyze(reqs, skillsQ.data ?? [], rm?.role, mode), [reqs, skillsQ.data, rm?.role, mode]);
  const score = readiness(items);
  const focus = items.filter((i) => i.priority > 0).sort((a, b) => b.priority - a.priority).slice(0, 3);
  const inRoadmap = new Set((prefsQ.data?.priority_skills ?? []).map((s) => s.toLowerCase()));
  const lastUpdated = (skillsQ.data ?? []).reduce<string | null>((m, s) => (!m || s.updated_at > m ? s.updated_at : m), null);

  const add = useMutation({
    mutationFn: (skills: string[]) => addPrioritySkills(skills),
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ["roadmap_prefs"] });
      toast.success(added.length ? `Added ${added.join(", ")} to your roadmap priorities` : "Already prioritised in your roadmap");
    },
    onError: () => toast.error("Couldn't update your roadmap. Please try again."),
  });

  if (profile.isLoading || skillsQ.isLoading || catalog.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-20 w-2/3" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;
  }
  if (skillsQ.isError) {
    return <div className="rounded-2xl border bg-card p-10 text-center shadow-soft"><p className="font-medium">We couldn't load your skills.</p><button className={cn(btn, "mt-4")} onClick={() => skillsQ.refetch()}>Retry</button></div>;
  }

  const count = (s: Status) => items.filter((i) => i.status === s).length;
  const cats = CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c));
  const open = items.find((i) => i.skill === openSkill) ?? null;
  const unassessed = count("not_assessed");

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="eyebrow">Career intelligence</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Your Skill Gap Analysis</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Understand how your current skills compare with your target role, identify your highest-priority gaps, and build a plan to close them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => setRoleOpen(true)}><Target className="size-3.5" /> Change target role</button>
          {rm && <button className={btn} onClick={() => setAssessOpen(true)}><ClipboardCheck className="size-3.5" /> Reassess skills</button>}
          <Link to="/roadmap" className={btnPrimary}><MapIcon className="size-3.5" /> Build my roadmap</Link>
        </div>
      </div>

      {!rm && !job ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <Target className="mx-auto size-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Choose a target role to analyze your skills.</h2>
          <button className={cn(btnPrimary, "mt-5")} onClick={() => setRoleOpen(true)}>Choose target role</button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 animate-rise">
            <SummaryCard label={mode === "job" ? "Job alignment" : "Target role alignment"} value={score === null ? "—" : `${score}%`}
              hint={score === null ? "Rate your skills to calculate" : "Weighted by importance, not a hiring prediction"} />
            <SummaryCard label="Skills on target" value={`${count("on_target")}`} hint={`of ${items.length} required`} tone="text-success" />
            <SummaryCard label="Needs improvement" value={`${count("improve")}`} hint="Some skill, below target" tone="text-warning" />
            <SummaryCard label="Missing skills" value={`${count("missing")}`} hint={unassessed ? `${unassessed} not assessed yet` : "Not yet demonstrated"} tone="text-destructive" />
          </section>

          {score === null && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div>
                <p className="text-sm font-semibold">Set up your skill profile</p>
                <p className="text-sm text-muted-foreground">Rate your level in the {items.length} skills this {mode === "job" ? "job" : "role"} needs. It takes about two minutes and you can change it anytime.</p>
              </div>
              <button className={btnPrimary} onClick={() => setAssessOpen(true)}>Rate my skills</button>
            </div>
          )}

          {/* Target panel */}
          <section className="mb-8 rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex rounded-lg border bg-background p-0.5 text-sm w-fit">
                  <button onClick={() => nav({ search: {} })} className={cn("rounded-md px-3 py-1", mode === "role" ? "bg-muted font-medium" : "text-muted-foreground")}>General role analysis</button>
                  <button disabled={!jobs.length} title={jobs.length ? "Analyze a real synced job" : "No real jobs are synced yet"} onClick={() => { const id = job?.id ?? jobs[0]?.id; if (id) nav({ search: { job: id } }); }} className={cn("rounded-md px-3 py-1 disabled:opacity-50", mode === "job" ? "bg-muted font-medium" : "text-muted-foreground")}>Job-specific analysis</button>
                </div>
                <p className="mt-3 text-base font-semibold">
                  {mode === "job" && job ? `${job.title} · ${job.company}` : rm?.role}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Based on 1 {mode === "job" ? "job listing" : "role profile"} ({source}){lastUpdated ? ` · Your skills last updated ${new Date(lastUpdated).toLocaleDateString()}` : ""}
                </p>
                {mode === "job" && <p className="mt-1 text-xs text-muted-foreground">This listing names its skills but not levels, so Intermediate is assumed for each.</p>}
              </div>
              {mode === "job" && (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={job?.id} onChange={(e) => nav({ search: { job: e.target.value } })} className="h-8 rounded-lg border bg-card px-2 text-sm">
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
                  </select>
                  {job && <Link to="/jobs/$jobId" params={{ jobId: job.id }} className={cn(btn, "text-xs")}><Briefcase className="size-3.5" /> View job</Link>}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {items.map((i) => (
                <span key={i.skill} className="rounded-full border px-2.5 py-0.5 text-xs">
                  {i.skill} <span className="text-muted-foreground">· {LEVELS[i.level]}{i.importance === "Preferred" ? " · preferred" : ""}</span>
                </span>
              ))}
            </div>
          </section>

          {/* Focus */}
          <section className="mb-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Skills to focus on</h2>
                <p className="text-xs text-muted-foreground">Ranked by importance, size of the gap, and how many other gaps depend on it.</p>
              </div>
              {focus.length > 0 && (
                <button className={cn(btn, "text-xs")} disabled={add.isPending} onClick={() => add.mutate(focus.map((f) => f.skill))}><Plus className="size-3.5" /> Add these to roadmap</button>
              )}
            </div>
            {focus.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {focus.map((f, idx) => (
                  <article key={f.skill} className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-widest text-muted-foreground">PRIORITY {idx + 1}</span>
                      <StatusPill s={f.status} />
                    </div>
                    <h3 className="mt-2 text-base font-semibold">{f.skill}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{f.current !== undefined ? LEVELS[f.current] : "Not assessed"} → {LEVELS[f.level]}{f.hours ? ` · ~${f.hours}h estimated` : ""}</p>
                    <p className="mt-3 text-sm"><span className="text-muted-foreground">Why it matters: </span>{f.reason}</p>
                    {f.prereqSkills.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Builds on: {f.prereqSkills.join(", ")}</p>}
                    <p className="mt-2 text-sm"><span className="text-muted-foreground">Next step: </span>{f.action}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <button className={cn(btn, "text-xs")} onClick={() => setOpenSkill(f.skill)}>View learning plan</button>
                      <AddBtn skill={f.skill} added={inRoadmap.has(f.skill.toLowerCase())} busy={add.isPending} onAdd={() => add.mutate([f.skill])} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-soft">
                {unassessed === items.length ? "Rate your skills to see which gaps to focus on first." : "No open gaps among the skills you've rated. Rate the remaining skills or try a job-specific analysis."}
              </div>
            )}
          </section>

          {/* Categories */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">All skills</h2>
              <Legend />
            </div>
            {cats.map((c) => {
              const rows = items.filter((i) => i.category === c);
              const on = rows.filter((r) => r.status === "on_target").length;
              const isC = collapsed[c] ?? false;
              return (
                <div key={c} className="rounded-2xl border bg-card shadow-soft">
                  <button onClick={() => setCollapsed((x) => ({ ...x, [c]: !isC }))} className="flex w-full items-center gap-4 p-4 text-left" aria-expanded={!isC}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c}</p>
                      <p className="text-xs text-muted-foreground">{rows.length} skill{rows.length > 1 ? "s" : ""} · {on} on target</p>
                    </div>
                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full bg-success" style={{ width: `${(100 * on) / rows.length}%` }} /></div>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !isC && "rotate-180")} />
                  </button>
                  {!isC && (
                    <div className="divide-y border-t">
                      {rows.map((r) => <SkillRow key={r.skill} r={r} onOpen={() => setOpenSkill(r.skill)} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Alignment = each skill's level ÷ target (capped at 100%), with required skills counted twice as much as preferred ones. Unrated skills count as zero. It describes skill fit only — it doesn't predict interviews or offers.
          </p>
        </>
      )}

      <SkillSheet r={open} onClose={() => setOpenSkill(null)} added={!!open && inRoadmap.has(open.skill.toLowerCase())} busy={add.isPending}
        onAdd={() => open && add.mutate([open.skill])} />
      <AssessDialog open={assessOpen} onOpenChange={setAssessOpen} items={items} />
      <RoleDialog open={roleOpen} onOpenChange={setRoleOpen} current={rm?.role ?? null} onDone={() => nav({ search: {} })} />
    </>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusPill({ s }: { s: Status }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[s].bg, TONE[s].text)}>{STATUS_LABEL[s]}</span>;
}

function AddBtn({ added, busy, onAdd }: { skill: string; added: boolean; busy: boolean; onAdd: () => void }) {
  return added
    ? <Link to="/roadmap" className={cn(btn, "text-xs text-primary")}><MapIcon className="size-3.5" /> In roadmap</Link>
    : <button className={cn(btnPrimary, "text-xs")} disabled={busy} onClick={onAdd}><Plus className="size-3.5" /> Add to roadmap</button>;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-primary/60" /> Your level</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-foreground" /> Target</span>
    </div>
  );
}

function LevelScale({ current, target, s }: { current?: number | undefined; target: number; s: Status }) {
  // Five discrete steps so the bar never suggests more precision than the rating has.
  return (
    <div className="relative flex gap-1" aria-label={`Your level ${current !== undefined ? LEVELS[current] : "not assessed"}, target ${LEVELS[target]}`}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="relative h-2 flex-1">
          <div className={cn("h-full rounded-full", current !== undefined && current >= n ? TONE[s].bar : "bg-muted")} />
          {n === target && <span className="absolute -top-1 -right-0.5 h-4 w-0.5 rounded bg-foreground" />}
        </div>
      ))}
    </div>
  );
}

function SkillRow({ r, onOpen }: { r: Analyzed; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="grid w-full gap-x-6 gap-y-2 px-4 py-4 text-left transition hover:bg-muted/40 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-center">
      <div>
        <p className="text-sm font-medium">{r.skill}</p>
        <p className="text-[11px] text-muted-foreground">{r.importance}{r.source ? ` · ${SOURCE_LABEL[r.source]}` : ""}</p>
      </div>
      <div className="min-w-0">
        <LevelScale current={r.current} target={r.level} s={r.status} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          You: <span className="font-medium text-foreground">{r.current !== undefined ? LEVELS[r.current] : "Not assessed"}</span> · Target: <span className="font-medium text-foreground">{LEVELS[r.level]}</span>
          <span className="hidden md:inline"> · {r.action}</span>
        </p>
      </div>
      <StatusPill s={r.status} />
    </button>
  );
}

function SkillSheet({ r, onClose, added, busy, onAdd }: { r: Analyzed | null; onClose: () => void; added: boolean; busy: boolean; onAdd: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (level: number) => saveSkillLevels([{ skill: r!.skill, level }]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_skills"] }); toast.success("Skill level saved"); },
    onError: () => toast.error("Couldn't save your skill level."),
  });
  const objectives = r ? Array.from(new Set(r.activities.flatMap((a) => a.objectives))).slice(0, 6) : [];
  const concepts = r ? Array.from(new Set(r.activities.flatMap((a) => a.concepts))).slice(0, 8) : [];
  const task = r?.activities.flatMap((a) => a.practice)[0];
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {r && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><StatusPill s={r.status} /><span className="text-xs text-muted-foreground">{r.category}</span></div>
              <SheetTitle className="text-xl">{r.skill}</SheetTitle>
              <SheetDescription>{r.reason}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Current level</p>
                  <p className="mt-1 font-semibold">{r.current !== undefined ? LEVELS[r.current] : "Not assessed"}</p>
                  <p className="text-[11px] text-muted-foreground">{r.source ? `${SOURCE_LABEL[r.source]} · ${new Date(r.updatedAt!).toLocaleDateString()}` : "No rating yet"}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Required level</p>
                  <p className="mt-1 font-semibold">{LEVELS[r.level]}</p>
                  <p className="text-[11px] text-muted-foreground">{r.importance}</p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Assess my skill</h3>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.map((l, i) => (
                    <button key={l} disabled={save.isPending} onClick={() => save.mutate(i)}
                      className={cn("rounded-lg border px-2.5 py-1 text-xs transition", r.current === i ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>{l}</button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Self-reported. Choose the level you could demonstrate in an interview today.</p>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">What to close the gap</h3>
                <p>{r.status === "on_target" ? "You meet the target. Keep evidence of it on your resume." : r.action}</p>
                {r.hours && r.status !== "on_target" && <p className="mt-1 text-xs text-muted-foreground">Estimated effort: ~{r.hours}h across {r.activities.length} roadmap activit{r.activities.length > 1 ? "ies" : "y"} (estimate).</p>}
              </section>

              {objectives.length > 0 && <List title="Learning objectives" items={objectives} />}
              {concepts.length > 0 && <List title="Subtopics" items={concepts} />}
              {r.prereqSkills.length > 0 && <List title="Prerequisites" items={r.prereqSkills} />}
              {task && <List title="Practice task" items={[task]} />}

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Learning resources</h3>
                {r.resources.length ? (
                  <ul className="space-y-1.5">
                    {r.resources.map((x) => (
                      <li key={x.url}>
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-2.5 transition hover:border-primary/30 hover:bg-muted/50">
                          <BookOpen className="size-4 text-primary" />
                          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.title}</span><span className="text-xs text-muted-foreground">{x.kind} · {x.provider}</span></span>
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No learning plan is configured for this skill yet.</p>}
              </section>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                {r.status !== "on_target" && <AddBtn skill={r.skill} added={added} busy={busy} onAdd={onAdd} />}
                <Link to="/roadmap" className={btn}><MapIcon className="size-3.5" /> View roadmap</Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-1.5">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" /><span>{x}</span></li>)}</ul>
    </section>
  );
}

function AssessDialog({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: Analyzed[] }) {
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, number>>({});
  const m = useMutation({
    mutationFn: () => saveSkillLevels(Object.entries(vals).map(([skill, level]) => ({ skill, level }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_skills"] }); toast.success("Skill profile updated"); onOpenChange(false); },
    onError: () => toast.error("Couldn't save your skills."),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setVals(Object.fromEntries(items.filter((i) => i.current !== undefined).map((i) => [i.skill, i.current!]))); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate your skills</DialogTitle>
          <DialogDescription>Pick the level you could demonstrate today. These are saved as self-reported and you can change them anytime.</DialogDescription>
        </DialogHeader>
        <div className="divide-y">
          {items.map((i) => (
            <div key={i.skill} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><p className="text-sm font-medium">{i.skill}</p><p className="text-[11px] text-muted-foreground">Target: {LEVELS[i.level]}</p></div>
              <select value={vals[i.skill] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [i.skill]: Number(e.target.value) }))} className="h-8 rounded-lg border bg-card px-2 text-sm">
                <option value="" disabled>Not assessed</option>
                {LEVELS.map((l, n) => <option key={l} value={n}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <button className={btn} onClick={() => onOpenChange(false)}>Cancel</button>
          <button className={btnPrimary} disabled={m.isPending || !Object.keys(vals).length} onClick={() => m.mutate()}>Save skills</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ open, onOpenChange, current, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; current: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState(current ?? ROLE_NAMES[0]!);
  const m = useMutation({
    mutationFn: () => setTargetRole(pick),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success(`Target role set to ${pick}`); onOpenChange(false); onDone(); },
    onError: () => toast.error("Couldn't update your target role."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change target role</DialogTitle>
          <DialogDescription>Updates your profile and your roadmap. Your skill ratings and roadmap progress are kept.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_NAMES.map((r) => (
            <button key={r} onClick={() => setPick(r)} className={cn("rounded-lg border px-3 py-2 text-left text-sm transition", pick === r ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted")}>{r}</button>
          ))}
        </div>
        <DialogFooter>
          <button className={btn} onClick={() => onOpenChange(false)}>Cancel</button>
          <button className={btnPrimary} disabled={m.isPending || pick === current} onClick={() => m.mutate()}>Save role</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
