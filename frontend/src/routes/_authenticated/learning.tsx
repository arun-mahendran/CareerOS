import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Check, Clock, ExternalLink, Map as MapIcon, MessagesSquare, Search, Target } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { profileQuery } from "@/lib/user-data";
import { findRoadmap } from "@/lib/roadmap/catalog";
import { roadmapProgressQuery, studyLogsQuery } from "@/lib/roadmap/service";
import { ROLE_REQUIREMENTS, analyze, userSkillsQuery } from "@/lib/skills/model";
import { LIBRARY, LIBRARY_TABS, resourceProgressQuery, updateResource, type LibResource, type ResourceProgress } from "@/lib/learning/library";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/learning")({
  head: () => ({
    meta: [
      { title: "Learning hub — CareerOS" },
      { name: "description", content: "Trusted learning resources matched to your target role and skill gaps." },
      { property: "og:title", content: "Learning hub — CareerOS" },
      { property: "og:description", content: "Trusted learning resources matched to your target role and skill gaps." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Learning,
});

const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50";

type Rec = { r: LibResource; why: string };

function Learning() {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery);
  const skillsQ = useQuery(userSkillsQuery);
  const roadmapQ = useQuery(roadmapProgressQuery);
  const logsQ = useQuery(studyLogsQuery);
  const progQ = useQuery(resourceProgressQuery);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("All");
  const [view, setView] = useState<"all" | "saved" | "completed">("all");
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const rm = findRoadmap(profile.data?.target_role);
  const prog = useMemo(() => new Map((progQ.data ?? []).map((p) => [p.resource_url, p])), [progQ.data]);

  const mut = useMutation({
    mutationFn: ({ r, patch }: { r: LibResource; patch: Partial<Pick<ResourceProgress, "saved" | "status">> }) => updateResource(r.url, patch, prog.get(r.url)),
    onSuccess: (_d, v) => toast.success(v.patch.saved === true ? "Saved to your library" : v.patch.saved === false ? "Removed from saved" : v.patch.status === "completed" ? "Marked as completed" : "Progress updated"),
    onError: () => toast.error("Couldn't save that change. Please try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["learning_resource_progress"] }),
  });
  const toggleSave = (r: LibResource) => mut.mutate({ r, patch: { saved: !prog.get(r.url)?.saved } });

  const { recs, recMode, nextActivity, interview } = useMemo(() => {
    const done = (r: LibResource) => prog.get(r.url)?.status === "completed";
    const out: Rec[] = [];
    const push = (r: LibResource, why: string) => { if (!done(r) && !out.some((o) => o.r.url === r.url)) out.push({ r, why }); };
    let mode: "gaps" | "role" | "none" = "none";
    if (rm) {
      const items = analyze(ROLE_REQUIREMENTS[rm.role] ?? [], skillsQ.data ?? [], rm.role, "role");
      const gaps = items.filter((i) => i.priority > 0).sort((a, b) => b.priority - a.priority);
      for (const g of gaps) {
        const roleIds = new Set(rm.phases.flatMap((p) => p.activities));
        const fit = (r: LibResource) => (r.activities.some((a) => roleIds.has(a.id)) ? 2 : 0) + (r.difficulty === "Beginner" && (g.current ?? 0) <= 1 ? 1 : 0);
        const pool = LIBRARY.filter((r) => r.skills.includes(g.skill)).sort((a, b) => fit(b) - fit(a));
        for (const r of pool.slice(0, 1)) push(r, `${g.skill} is ${g.status === "missing" ? "a missing" : "a below-target"} ${g.importance.toLowerCase()} skill for ${rm.role}.`);
      }
      if (out.length) mode = "gaps";
      else {
        for (const req of ROLE_REQUIREMENTS[rm.role] ?? []) {
          const r = LIBRARY.find((x) => x.skills.includes(req.skill));
          if (r) push(r, `Builds ${req.skill}, a ${req.importance.toLowerCase()} skill for ${rm.role}.`);
        }
        mode = "role";
      }
    }
    const doneIds = new Set((roadmapQ.data ?? []).filter((p) => p.status === "completed" || p.status === "skipped").map((p) => p.step_id));
    const ids = rm?.phases.flatMap((p) => p.activities) ?? [];
    const nextId = ids.find((id) => !doneIds.has(id) && LIBRARY.some((r) => r.activities.some((a) => a.id === id)));
    const nextRes = nextId ? LIBRARY.find((r) => r.activities.some((a) => a.id === nextId)) : undefined;
    const iv = LIBRARY.filter((r) => r.category === "Interview Preparation" || r.skills.includes("Data Structures")).slice(0, 2);
    return { recs: out.slice(0, 4), recMode: mode, nextActivity: nextRes ? { r: nextRes, title: nextRes.activities.find((a) => a.id === nextId)!.title } : null, interview: iv };
  }, [rm, skillsQ.data, roadmapQ.data, prog]);

  if (profile.isLoading || progQ.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-24 w-2/3" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-64" /></div>;
  }

  const rows = progQ.data ?? [];
  const saved = rows.filter((r) => r.saved).length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const minutes = (logsQ.data ?? []).reduce((s, l) => s + l.minutes, 0);
  const active = new Set<string>();
  for (const p of rows) if (p.saved || p.status === "in_progress") LIBRARY.find((r) => r.url === p.resource_url)?.skills.forEach((s) => active.add(s));
  const inProgIds = new Set((roadmapQ.data ?? []).filter((p) => p.status === "in_progress").map((p) => p.step_id));
  for (const r of LIBRARY) for (const a of r.activities) if (inProgIds.has(a.id) && a.skill) active.add(a.skill);

  const term = q.trim().toLowerCase();
  const list = LIBRARY.filter((r) =>
    (tab === "All" || r.category === tab) &&
    (view === "all" || (view === "saved" ? prog.get(r.url)?.saved : prog.get(r.url)?.status === "completed")) &&
    (!term || [r.title, r.provider, r.description, r.type, r.category, ...r.skills, ...r.activities.flatMap((a) => [a.title, ...a.concepts])].join(" ").toLowerCase().includes(term)));
  const open = LIBRARY.find((r) => r.url === openUrl) ?? null;

  return (
    <>
      <div className="mb-8 animate-rise">
        <p className="eyebrow">Learning hub</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Learn what moves you forward</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Discover trusted learning resources selected for your career goals, strengthen your skills, and make progress toward your target role.</p>
        {rm && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs"><Target className="size-3 text-primary" /> Your learning path: <span className="font-medium">{rm.role}</span></p>}
        <label className="relative mt-5 block max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tutorials, documentation, courses, skills..." className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm shadow-soft outline-none focus:border-primary/40" />
        </label>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saved resources" value={String(saved)} hint={saved ? "In your library" : "Save resources to find them later"} />
        <Stat label="Completed resources" value={String(completed)} hint="Marked complete by you" />
        <Stat label="Learning hours" value={minutes ? `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)}h` : "0h"} hint="Time logged on your roadmap" />
        <Stat label="Skills being developed" value={String(active.size)} hint={active.size ? [...active].slice(0, 3).join(", ") : "From saved & in-progress items"} />
      </section>

      {/* Recommendations */}
      {!term && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold">Recommended for your skill gaps</h2>
          <p className="text-sm text-muted-foreground">
            {recMode === "gaps" ? "Resources selected to help you improve the skills that matter for your target role."
              : recMode === "role" ? "No open gaps found in your rated skills — these help you go deeper in your target role."
              : "Choose a target role to get personalized recommendations."}
          </p>
          {recMode === "role" && !(skillsQ.data ?? []).length && <p className="mt-1 text-xs text-muted-foreground"><Link to="/skills" className="font-medium text-primary hover:underline">Rate your skills</Link> to get recommendations aimed at your actual gaps.</p>}
          {recs.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recs.map(({ r, why }) => (
                <article key={r.url} className="flex flex-col rounded-2xl border border-primary/15 bg-card p-4 shadow-soft">
                  <p className="text-[11px] text-muted-foreground">{r.provider}</p>
                  <button onClick={() => setOpenUrl(r.url)} className="mt-0.5 line-clamp-2 text-left text-sm font-semibold hover:text-primary">{r.title}</button>
                  <Meta r={r} />
                  <p className="mt-2 text-xs"><span className="text-muted-foreground">Why: </span>{why}</p>
                  <div className="mt-auto flex gap-2 pt-3">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>View resource <ExternalLink className="size-3" /></a>
                    <SaveBtn saved={!!prog.get(r.url)?.saved} busy={mut.isPending} onClick={() => toggleSave(r)} />
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MiniCard icon={<MapIcon className="size-4" />} title="Continue your roadmap"
              body={nextActivity ? <>Next: <span className="font-medium">{nextActivity.title}</span> — <button className="text-primary hover:underline" onClick={() => setOpenUrl(nextActivity.r.url)}>{nextActivity.r.title}</button></> : "Your roadmap has no pending activities with resources."}
              link={<Link to="/roadmap" className="text-xs font-medium text-primary hover:underline">Open roadmap →</Link>} />
            <MiniCard icon={<Target className="size-4" />} title="Close your skill gaps"
              body={recMode === "gaps" ? `${recs.length} resource${recs.length > 1 ? "s" : ""} above target your highest-priority gaps.` : "See which skills matter most for your role."}
              link={<Link to="/skills" className="text-xs font-medium text-primary hover:underline">View skill gaps →</Link>} />
            <MiniCard icon={<MessagesSquare className="size-4" />} title="Prepare for interviews"
              body={interview.length ? <>Practise with {interview.map((r, i) => <span key={r.url}>{i ? " and " : ""}<button className="text-primary hover:underline" onClick={() => setOpenUrl(r.url)}>{r.provider}</button></span>)}.</> : "Practise common questions for your role."}
              link={<Link to="/interviews" className="text-xs font-medium text-primary hover:underline">Interview prep →</Link>} />
          </div>
        </section>
      )}

      {/* Library */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">Explore learning resources</h2>
          <div className="flex rounded-lg border bg-card p-0.5 text-xs">
            {(["all", "saved", "completed"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 capitalize", view === v ? "bg-muted font-medium" : "text-muted-foreground")}>{v === "all" ? "All" : v}</button>
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {["All", ...LIBRARY_TABS].map((c) => (
            <button key={c} onClick={() => setTab(c)} className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", tab === c ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-muted")}>{c === "All" ? "All resources" : c}</button>
          ))}
        </div>
        {list.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => <ResourceCard key={r.url} r={r} p={prog.get(r.url)} busy={mut.isPending} onOpen={() => setOpenUrl(r.url)} onSave={() => toggleSave(r)} />)}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            {view === "saved" ? "You haven't saved any resources yet." : view === "completed" ? "No completed resources yet." : `No resources match “${q}”.`}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">All resources open on external sites. Pricing isn't tracked here — check the provider before signing up.</p>
      </section>

      <ResourceSheet r={open} p={open ? prog.get(open.url) : undefined} busy={mut.isPending} role={rm?.role}
        onClose={() => setOpenUrl(null)} onSave={() => open && toggleSave(open)}
        onStatus={(status) => open && mut.mutate({ r: open, patch: { status } })} onOpen={(u) => setOpenUrl(u)} />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function MiniCard({ icon, title, body, link }: { icon: React.ReactNode; title: string; body: React.ReactNode; link: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><span className="text-primary">{icon}</span>{title}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
      <div className="mt-auto pt-2">{link}</div>
    </div>
  );
}

function Meta({ r }: { r: LibResource }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {r.skills.slice(0, 2).map((s) => <span key={s} className="rounded-md bg-accent px-1.5 py-0.5 text-accent-foreground">{s}</span>)}
      <span>{r.type}</span>
      {r.difficulty && <><span>·</span><span>{r.difficulty}</span></>}
      {r.minutes && <><span>·</span><span className="inline-flex items-center gap-1"><Clock className="size-3" />{Math.round(r.minutes / 60)}h</span></>}
    </div>
  );
}

function SaveBtn({ saved, busy, onClick }: { saved: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save resource"} className={cn(btn, saved && "text-primary")}>
      {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}{saved ? "Saved" : "Save"}
    </button>
  );
}

function ResourceCard({ r, p, busy, onOpen, onSave }: { r: LibResource; p?: ResourceProgress | undefined; busy: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <article className="lift flex flex-col rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{r.provider}</p>
        {p?.status === "completed" && <span className="inline-flex items-center gap-1 text-[11px] text-success"><Check className="size-3" /> Completed</span>}
        {p?.status === "in_progress" && <span className="text-[11px] text-primary">In progress</span>}
      </div>
      <button onClick={onOpen} className="mt-1 line-clamp-2 text-left font-medium hover:text-primary">{r.title}</button>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
      <Meta r={r} />
      <div className="mt-auto flex items-center gap-2 pt-4">
        <a href={r.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Open resource <ExternalLink className="size-3" /></a>
        <SaveBtn saved={!!p?.saved} busy={busy} onClick={onSave} />
        <button onClick={onOpen} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Details</button>
      </div>
    </article>
  );
}

function ResourceSheet({ r, p, busy, role, onClose, onSave, onStatus, onOpen }: {
  r: LibResource | null; p?: ResourceProgress | undefined; busy: boolean; role?: string | undefined;
  onClose: () => void; onSave: () => void; onStatus: (s: ResourceProgress["status"]) => void; onOpen: (url: string) => void;
}) {
  const related = r ? LIBRARY.filter((x) => x.url !== r.url && x.skills.some((s) => r.skills.includes(s))).slice(0, 4) : [];
  const status = p?.status ?? "not_started";
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {r && (
          <>
            <SheetHeader>
              <p className="text-xs text-muted-foreground">{r.provider} · External resource</p>
              <SheetTitle className="text-xl">{r.title}</SheetTitle>
              <SheetDescription>{r.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6 text-sm">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Format</dt><dd className="mt-0.5 font-medium">{r.type}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Level</dt><dd className="mt-0.5 font-medium">{r.difficulty ?? "Not specified"}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Skills</dt><dd className="mt-0.5 font-medium">{r.skills.join(", ") || "General"}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Estimated time</dt><dd className="mt-0.5 font-medium">{r.minutes ? `~${Math.round(r.minutes / 60)}h` : "Not specified"}</dd></div>
              </dl>
              {role && r.skills.length > 0 && <p className="text-xs text-muted-foreground">Useful for {role} because it builds {r.skills.join(" and ")}.</p>}

              {r.activities.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Related roadmap activities</h3>
                  <ul className="space-y-1.5">{r.activities.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5"><span>{a.title}</span><span className="text-xs text-muted-foreground">~{a.hours}h</span></li>)}</ul>
                  <Link to="/roadmap" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open in roadmap →</Link>
                </section>
              )}

              {related.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Related resources</h3>
                  <ul className="space-y-1">{related.map((x) => <li key={x.url}><button onClick={() => onOpen(x.url)} className="text-left text-sm hover:text-primary">{x.title} <span className="text-xs text-muted-foreground">· {x.provider}</span></button></li>)}</ul>
                </section>
              )}

              <section className="rounded-xl border bg-muted/30 p-3">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your progress</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(["not_started", "in_progress", "completed"] as const).map((s) => (
                    <button key={s} disabled={busy} onClick={() => onStatus(s)} className={cn("rounded-lg border px-2.5 py-1 text-xs", status === s ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-muted")}>
                      {s === "not_started" ? "Not started" : s === "in_progress" ? "In progress" : "Completed"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Opening a link doesn't mark it complete.{p?.completed_at ? ` Completed on ${new Date(p.completed_at).toLocaleDateString()}.` : ""}</p>
              </section>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Open original resource <ExternalLink className="size-3" /></a>
                <SaveBtn saved={!!p?.saved} busy={busy} onClick={onSave} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
