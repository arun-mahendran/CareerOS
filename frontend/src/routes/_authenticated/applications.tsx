import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, BellRing, Briefcase, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Compass, ExternalLink, FileText, Info, KanbanSquare, List, MessagesSquare, MoreHorizontal, Pencil, Plus, Search, Send, Trash2, Trophy, X } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CompanyMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { jobCatalogQuery } from "@/lib/job-catalog";
import { resumesQuery } from "@/lib/resume/service";
import { applicationsQuery, createApplication, deleteApplication, fmtDate, followUpState, JOB_TYPES, STAGE_LABEL, STAGES, updateApplication, type Application, type AppInput, type Stage } from "@/lib/applications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "My applications — CareerOS" }, { name: "description", content: "Organize your job search, track each application's stage and stay on top of follow-ups." }, { property: "og:title", content: "My applications — CareerOS" }, { property: "og:description", content: "Organize your job search, track each application's stage and stay on top of follow-ups." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Applications,
});

const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-ring/25";
const sel = "rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/25";

const STAGE_TONE: Record<Stage, string> = {
  saved: "bg-muted text-muted-foreground border-border",
  applied: "bg-primary/10 text-primary border-primary/20",
  assessment: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  interviewing: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

function StageBadge({ s }: { s: Stage }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", STAGE_TONE[s])}><span className="size-1.5 rounded-full bg-current" />{STAGE_LABEL[s]}</span>;
}

function FollowBadge({ a }: { a: Application }) {
  const st = followUpState(a);
  if (!st) return <span className="text-muted-foreground">—</span>;
  const map = { overdue: ["Overdue", "text-destructive"], today: ["Due today", "text-warning"], upcoming: ["Upcoming", "text-primary"], later: ["", "text-foreground"], done: ["Done", "text-success"] } as const;
  const [label, tone] = map[st];
  return <span className="whitespace-nowrap text-sm">{fmtDate(a.followUpOn)}{label && <span className={cn("ml-1.5 text-[11px] font-medium", tone)}>{label}</span>}</span>;
}

function useApps() {
  const qc = useQueryClient();
  const q = useQuery(applicationsQuery);
  const refresh = () => qc.invalidateQueries({ queryKey: ["saved_jobs"] });
  const update = useMutation({
    mutationFn: ({ a, patch }: { a: Application; patch: Partial<AppInput> }) => updateApplication(a, patch),
    onSuccess: refresh,
    onError: () => toast.error("Couldn't save that change. Try again."),
  });
  return { q, update, refresh };
}

function Applications() {
  const { q, update, refresh } = useApps();
  const apps = q.data ?? [];
  const [view, setView] = useState<"list" | "kanban">("list");
  const [form, setForm] = useState<{ open: boolean; edit?: Application | undefined }>({ open: false });
  const [detail, setDetail] = useState<string | null>(null);
  const [del, setDel] = useState<Application | null>(null);
  const [f, setF] = useState({ q: "", status: "", location: "", type: "", added: "", sort: "updated" });

  useEffect(() => { const v = localStorage.getItem("careeros_app_view"); if (v === "kanban" || v === "list") setView(v); }, []);
  const switchView = (v: "list" | "kanban") => { setView(v); localStorage.setItem("careeros_app_view", v); };

  const locations = useMemo(() => [...new Set(apps.map((a) => a.location).filter(Boolean))].sort(), [apps]);
  const filtered = useMemo(() => {
    const now = Date.now();
    const days = f.added ? Number(f.added) : 0;
    const out = apps.filter((a) =>
      (!f.q || `${a.company} ${a.title}`.toLowerCase().includes(f.q.toLowerCase())) &&
      (!f.status || a.status === f.status) && (!f.location || a.location === f.location) && (!f.type || a.jobType === f.type) &&
      (!days || now - new Date(a.createdAt).getTime() <= days * 86400000));
    return f.sort === "follow"
      ? [...out].sort((x, y) => (x.followUpOn && !x.followUpDone ? x.followUpOn : "9999").localeCompare(y.followUpOn && !y.followUpDone ? y.followUpOn : "9999"))
      : [...out].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  }, [apps, f]);
  const active = f.q || f.status || f.location || f.type || f.added;

  const count = (s: Stage) => apps.filter((a) => a.status === s).length;
  const followUps = apps.filter((a) => ["overdue", "today", "upcoming"].includes(followUpState(a) ?? ""));
  const stats = [
    { label: "Total applications", value: apps.length, icon: Briefcase, tone: "bg-accent text-accent-foreground" },
    { label: "Applied", value: count("applied"), icon: Send, tone: "bg-primary/10 text-primary" },
    { label: "Interviews", value: count("interviewing"), icon: MessagesSquare, tone: "bg-warning/15 text-warning" },
    { label: "Offers", value: count("offer"), icon: Trophy, tone: "bg-success/10 text-success" },
    { label: "Follow-ups", value: followUps.length, icon: BellRing, tone: "bg-destructive/10 text-destructive" },
  ];
  const detailApp = apps.find((a) => a.id === detail) ?? null;
  const setStatus = (a: Application, s: Stage) => update.mutate({ a, patch: { status: s } }, { onSuccess: () => toast.success(`Moved to ${STAGE_LABEL[s]}`) });
  const actions = { open: (a: Application) => setDetail(a.id), edit: (a: Application) => setForm({ open: true, edit: a }), remove: (a: Application) => setDel(a), setStatus };

  return (
    <>
      <PageHeader
        eyebrow="Application organizer"
        title="My Applications"
        sub="Organize your job search, track your progress, and stay prepared for your next opportunity."
        right={<div className="flex gap-2"><Link to="/jobs" className={btn}><Compass className="size-4" /> Explore Jobs</Link><button className={btnPrimary} onClick={() => setForm({ open: true })}><Plus className="size-4" /> Add Application</button></div>}
      />

      {q.isLoading ? (
        <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div><Skeleton className="h-80 rounded-xl" /></div>
      ) : q.isError ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><AlertCircle className="size-4 text-destructive" /> Couldn't load your applications. <button className="font-medium underline" onClick={() => q.refetch()}>Retry</button></div>
      ) : apps.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-10 text-center shadow-soft">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><Briefcase className="size-5" /></span>
          <p className="mt-4 text-lg font-semibold">Your job-search journey starts here.</p>
          <p className="mt-1 text-sm text-muted-foreground">Save interesting jobs, record applications, and organize your progress as you move toward your next opportunity.</p>
          <div className="mt-6 flex justify-center gap-2"><Link to="/jobs" className={btnPrimary}><Compass className="size-4" /> Explore Jobs</Link><button className={btn} onClick={() => setForm({ open: true })}><Plus className="size-4" /> Add Application</button></div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-4" /></span>
                <div><p className="text-xl font-semibold tabular-nums leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
              </div>
            ))}
          </div>

          {followUps.length > 0 && (
            <section className="rounded-xl border bg-card shadow-soft">
              <header className="flex items-center gap-2 border-b px-4 py-3"><BellRing className="size-4 text-primary" /><h2 className="text-sm font-semibold">Follow-ups</h2><span className="text-xs text-muted-foreground">next 3 days and overdue</span></header>
              <ul className="divide-y">
                {followUps.sort((a, b) => a.followUpOn.localeCompare(b.followUpOn)).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(a.id)}><span className="font-medium">{a.company}</span> <span className="text-muted-foreground">· {a.followUpNote || a.title}</span></button>
                    <FollowBadge a={a} />
                    <button className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted" onClick={() => update.mutate({ a, patch: { followUpDone: true } }, { onSuccess: () => toast.success("Follow-up completed") })}><Check className="size-3" /> Mark done</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 shadow-soft">
            <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/25">
              <Search className="size-4 text-muted-foreground" />
              <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search company or job title" className="w-full bg-transparent outline-none" />
            </label>
            <select aria-label="Status" className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <select aria-label="Location" className={sel} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{locations.map((l) => <option key={l}>{l}</option>)}</select>
            <select aria-label="Job type" className={sel} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All job types</option>{JOB_TYPES.map((l) => <option key={l}>{l}</option>)}</select>
            <select aria-label="Date added" className={sel} value={f.added} onChange={(e) => setF({ ...f, added: e.target.value })}><option value="">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
            <select aria-label="Sort" className={sel} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="updated">Recently updated</option><option value="follow">Follow-up date</option></select>
            {active && <button className="inline-flex items-center gap-1 px-2 text-xs font-medium text-primary hover:underline" onClick={() => setF({ q: "", status: "", location: "", type: "", added: "", sort: f.sort })}><X className="size-3" /> Clear</button>}
            <div className="ml-auto flex rounded-lg border p-0.5">
              {([["list", List, "List"], ["kanban", KanbanSquare, "Kanban"]] as const).map(([v, Icon, label]) => (
                <button key={v} onClick={() => switchView(v)} aria-pressed={view === v} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", view === v ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="size-3.5" /> {label}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No applications match these filters.</div>
          ) : view === "list" ? <ListView apps={filtered} actions={actions} /> : <KanbanView apps={filtered} actions={actions} />}

          <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> CareerOS helps you organize your applications. Status information is based on your updates — employers confirm applications on their own portals.</p>
        </div>
      )}

      <AppForm open={form.open} edit={form.edit} existing={apps} onClose={() => setForm({ open: false })} onSaved={refresh} />
      <DetailSheet a={detailApp} onClose={() => setDetail(null)} actions={actions} update={(a, patch) => update.mutate({ a, patch }, { onSuccess: () => toast.success("Saved") })} />
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this application?</AlertDialogTitle><AlertDialogDescription>{del?.title} at {del?.company}, with its notes and history, will be removed from your organizer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { if (!del) return; try { await deleteApplication(del.id); setDetail(null); refresh(); toast.success("Application deleted"); } catch { toast.error("Couldn't delete. Try again."); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type Actions = { open: (a: Application) => void; edit: (a: Application) => void; remove: (a: Application) => void; setStatus: (a: Application, s: Stage) => void };

function RowMenu({ a, actions }: { a: Application; actions: Actions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Application actions" onClick={(e) => e.stopPropagation()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => actions.open(a)}>View details</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.edit(a)}><Pencil className="size-4" /> Edit application</DropdownMenuItem>
        {a.jobUrl && <DropdownMenuItem asChild><a href={a.jobUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open official job</a></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.remove(a)} className="text-destructive focus:text-destructive"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListView({ apps, actions }: { apps: Application[]; actions: Actions }) {
  const size = 10;
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(apps.length / size));
  const cur = Math.min(page, pages);
  const rows = apps.slice((cur - 1) * size, cur * size);
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <table className="hidden w-full table-fixed text-sm lg:table">
        <thead><tr className="border-b bg-surface text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          {[["Company & role", "w-[30%]"], ["Location", "w-[14%]"], ["Status", "w-[12%]"], ["Added", "w-[11%]"], ["Next follow-up", "w-[16%]"], ["Updated", "w-[11%]"], ["", "w-[6%]"]].map(([h, w]) => <th key={h} className={cn("px-4 py-2.5 font-medium", w)}>{h}</th>)}
        </tr></thead>
        <tbody className="divide-y">
          {rows.map((a) => (
            <tr key={a.id} onClick={() => actions.open(a)} className="cursor-pointer transition-colors hover:bg-surface">
              <td className="px-4 py-3"><div className="flex items-center gap-3"><CompanyMark name={a.company} /><div className="min-w-0"><p className="truncate font-medium">{a.title}</p><p className="truncate text-xs text-muted-foreground">{a.company}{a.jobType && ` · ${a.jobType}`}</p></div></div></td>
              <td className="truncate px-4 py-3 text-muted-foreground">{a.location || "—"}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><StatusSelect a={a} actions={actions} /></td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.createdAt).replace(/, \d{4}$/, "")}</td>
              <td className="px-4 py-3"><FollowBadge a={a} /></td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.updatedAt).replace(/, \d{4}$/, "")}</td>
              <td className="px-2 py-3 text-right"><RowMenu a={a} actions={actions} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y lg:hidden">
        {rows.map((a) => (
          <li key={a.id} onClick={() => actions.open(a)} className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface">
            <CompanyMark name={a.company} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.title}</p>
              <p className="truncate text-xs text-muted-foreground">{a.company}{a.location && ` · ${a.location}`}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><StageBadge s={a.status} />{a.followUpOn && <FollowBadge a={a} />}</div>
            </div>
            <RowMenu a={a} actions={actions} />
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>{apps.length} applications · page {cur} of {pages}</span>
          <div className="flex gap-1">
            <button aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
            <button aria-label="Next page" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusSelect({ a, actions }: { a: Application; actions: Actions }) {
  return (
    <select aria-label="Change status" value={a.status} onChange={(e) => actions.setStatus(a, e.target.value as Stage)} className={cn("cursor-pointer appearance-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium outline-none focus:ring-2 focus:ring-ring/25", STAGE_TONE[a.status])}>
      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
    </select>
  );
}

function KanbanView({ apps, actions }: { apps: Application[]; actions: Actions }) {
  const [over, setOver] = useState<Stage | null>(null);
  const drop = (s: Stage, id: string) => { const a = apps.find((x) => x.id === id); if (a && a.status !== s) actions.setStatus(a, s); setOver(null); };
  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex gap-3 px-1">
        {STAGES.map((s) => {
          const items = apps.filter((a) => a.status === s);
          return (
            <div key={s} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(s, e.dataTransfer.getData("text/plain"))}
              className={cn("flex max-h-[70vh] w-64 shrink-0 flex-col rounded-xl border bg-surface/70 transition-colors", over === s && "border-primary/40 bg-primary/5")}>
              <div className="sticky top-0 flex items-center justify-between px-3 py-2.5"><StageBadge s={s} /><span className="text-xs tabular-nums text-muted-foreground">{items.length}</span></div>
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {items.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop an application here</p> : items.map((a) => (
                  <article key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)} onClick={() => actions.open(a)} className="cursor-grab rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-float active:cursor-grabbing">
                    <div className="flex items-start gap-2">
                      <CompanyMark name={a.company} />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.title}</p><p className="truncate text-xs text-muted-foreground">{a.company}</p></div>
                      <RowMenu a={a} actions={actions} />
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {a.location && <p className="truncate">{a.location}</p>}
                      {a.appliedOn && <p>Applied {fmtDate(a.appliedOn)}</p>}
                      {a.followUpOn && <p className="flex items-center gap-1"><BellRing className="size-3" /> <FollowBadge a={a} /></p>}
                    </div>
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}><StatusSelect a={a} actions={actions} /></div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Add / edit ───────── */

const emptyInput = (): AppInput => ({ status: "applied", company: "", title: "", location: "", jobType: "", jobUrl: "", careerUrl: "", salary: "", notes: "", appliedOn: "", followUpOn: "", followUpDone: false, followUpNote: "", interviewAt: "", resumeId: "" });

function AppForm({ open, edit, existing, onClose, onSaved }: { open: boolean; edit?: Application | undefined; existing: Application[]; onClose: () => void; onSaved: () => void }) {
  const { data: resumes } = useQuery({ ...resumesQuery, enabled: open });
  const catalog = useQuery({ ...jobCatalogQuery, enabled: open });
  const jobs = catalog.data?.jobs ?? [];
  const [v, setV] = useState<AppInput>(emptyInput);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr({});
    if (edit) { const { id: _i, fromCatalog: _f, history: _h, createdAt: _c, updatedAt: _u, ...rest } = edit; setV(rest); }
    else setV(emptyInput());
  }, [open, edit]);
  const set = <K extends keyof AppInput>(k: K, val: AppInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const tracked = new Set(existing.map((a) => a.jobId));

  function pickJob(id: string) {
    const j = jobs.find((x) => x.id === id);
    if (!j) return setV((x) => ({ ...x, jobId: "" }));
    setV((x) => ({ ...x, jobId: j.id, company: j.company, title: j.title, location: j.location, jobUrl: j.portal, salary: j.salary, jobType: j.level === "Intern" ? "Internship" : "Full-time" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!v.company.trim()) er["company"] = "Enter the company name";
    if (!v.title.trim()) er["title"] = "Enter the job title";
    for (const k of ["jobUrl", "careerUrl"] as const) if (v[k] && !/^https?:\/\/\S+\.\S+/.test(v[k])) er[k] = "Use a full link starting with https://";
    if (!edit) {
      const dup = existing.find((a) => (v.jobId && a.jobId === v.jobId) || (a.company.toLowerCase() === v.company.trim().toLowerCase() && a.title.toLowerCase() === v.title.trim().toLowerCase()));
      if (dup) er["company"] = "You're already tracking this role — open it from the list instead.";
    }
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const clean = { ...v, company: v.company.trim(), title: v.title.trim() };
      if (edit) await updateApplication(edit, clean); else await createApplication(clean);
      toast.success(edit ? "Application updated" : "Application added");
      onSaved(); onClose();
    } catch (x) {
      toast.error((x as Error).message || "Couldn't save. Try again.");
    } finally { setBusy(false); }
  }

  const F = ({ k, label, type = "text", ph, opt }: { k: keyof AppInput; label: string; type?: string; ph?: string; opt?: boolean }) => (
    <label className="block text-xs font-medium">
      {label}{opt && <span className="ml-1 font-normal text-muted-foreground">optional</span>}
      <input type={type} value={String(v[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} className={cn(input, "mt-1.5", err[k] && "border-destructive")} />
      {err[k] && <span className="mt-1 block font-normal text-destructive">{err[k]}</span>}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? "Edit application" : "Add application"}</DialogTitle><DialogDescription>Record a role from CareerOS or one you found elsewhere.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!edit && (
            <label className="block text-xs font-medium">From CareerOS Opportunities <span className="font-normal text-muted-foreground">optional</span>
              <select value={v.jobId ?? ""} onChange={(e) => pickJob(e.target.value)} className={cn(input, "mt-1.5")}>
                <option value="">— A job I found outside CareerOS —</option>
                {jobs.map((j) => <option key={j.id} value={j.id} disabled={tracked.has(j.id)}>{j.company} — {j.title}{tracked.has(j.id) ? " (already tracked)" : ""}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {F({ k: "company", label: "Company name", ph: "Company" })}
            {F({ k: "title", label: "Job title", ph: "Software Engineer" })}
            <label className="block text-xs font-medium">Application status
              <select value={v.status} onChange={(e) => set("status", e.target.value as Stage)} className={cn(input, "mt-1.5")}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            </label>
            <label className="block text-xs font-medium">Job type <span className="font-normal text-muted-foreground">optional</span>
              <select value={v.jobType} onChange={(e) => set("jobType", e.target.value)} className={cn(input, "mt-1.5")}><option value="">—</option>{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            {F({ k: "location", label: "Location", ph: "Bengaluru / Remote", opt: true })}
            {F({ k: "salary", label: "Salary range", ph: "₹8–12 LPA", opt: true })}
            {F({ k: "jobUrl", label: "Official job URL", ph: "https://…", opt: true })}
            {F({ k: "careerUrl", label: "Company career page", ph: "https://…", opt: true })}
            {F({ k: "appliedOn", label: "Application date", type: "date", opt: true })}
            {F({ k: "interviewAt", label: "Interview date", type: "datetime-local", opt: true })}
            {F({ k: "followUpOn", label: "Follow-up date", type: "date", opt: true })}
            {F({ k: "followUpNote", label: "Follow-up reminder", ph: "e.g. Check status with recruiter", opt: true })}
            <label className="block text-xs font-medium sm:col-span-2">Resume used <span className="font-normal text-muted-foreground">optional</span>
              <select value={v.resumeId} onChange={(e) => set("resumeId", e.target.value)} className={cn(input, "mt-1.5")}><option value="">—</option>{(resumes ?? []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
            </label>
            <label className="block text-xs font-medium sm:col-span-2">Notes <span className="font-normal text-muted-foreground">optional</span>
              <textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} className={cn(input, "mt-1.5")} placeholder="Referral, recruiter name, what to prepare…" />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className={btn}>Cancel</button><button className={btnPrimary} disabled={busy}>{busy ? "Saving…" : "Save Application"}</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Details drawer ───────── */

function DetailSheet({ a, onClose, actions, update }: { a: Application | null; onClose: () => void; actions: Actions; update: (a: Application, patch: Partial<AppInput>) => void }) {
  const { data: resumes } = useQuery({ ...resumesQuery, enabled: !!a });
  const [fu, setFu] = useState("");
  useEffect(() => setFu(a?.followUpOn ?? ""), [a?.id, a?.followUpOn]);
  const resume = resumes?.find((r) => r.id === a?.resumeId);
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 truncate text-right">{children || <span className="text-muted-foreground">Not added</span>}</dd></div>;
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;

  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {a && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3"><CompanyMark name={a.company} /><div className="min-w-0"><SheetTitle className="truncate">{a.title}</SheetTitle><p className="text-sm text-muted-foreground">{a.company}</p></div></div>
            </SheetHeader>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={btn} onClick={() => actions.edit(a)}><Pencil className="size-4" /> Edit</button>
              {a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noreferrer" className={btnPrimary}><ExternalLink className="size-4" /> Open official job</a>}
              <button className={cn(btn, "text-destructive")} onClick={() => actions.remove(a)}><Trash2 className="size-4" /></button>
            </div>

            <H>Application status</H>
            <div className="flex items-center justify-between py-1.5"><StatusSelect a={a} actions={actions} /><span className="text-xs text-muted-foreground">Updated {fmtDate(a.updatedAt)}</span></div>
            <p className="text-[11px] text-muted-foreground">Status reflects your own updates, not the employer's system.</p>

            <H>Job information</H>
            <dl className="divide-y">
              <Row k="Location">{a.location}</Row>
              <Row k="Job type">{a.jobType}</Row>
              <Row k="Salary">{a.salary}</Row>
              <Row k="Official job">{a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{a.jobUrl.replace(/^https?:\/\//, "")}</a>}</Row>
              <Row k="Career page">{a.careerUrl && <a href={a.careerUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{a.careerUrl.replace(/^https?:\/\//, "")}</a>}</Row>
              <Row k="Date added">{fmtDate(a.createdAt)}</Row>
              <Row k="Applied on">{fmtDate(a.appliedOn)}</Row>
              {a.fromCatalog && <Row k="Listing"><Link to="/jobs/$jobId" params={{ jobId: a.jobId }} className="text-primary hover:underline">View in Opportunities</Link></Row>}
            </dl>

            <H>Follow-up</H>
            <div className="flex items-center gap-2">
              <input type="date" value={fu} onChange={(e) => setFu(e.target.value)} className={cn(input, "flex-1")} aria-label="Follow-up date" />
              <button className={btn} disabled={fu === a.followUpOn} onClick={() => update(a, { followUpOn: fu, followUpDone: false })}>Set</button>
            </div>
            {a.followUpOn && (
              <div className="mt-2 flex items-center justify-between text-sm"><FollowBadge a={a} />
                {!a.followUpDone && <button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => update(a, { followUpDone: true })}><CheckCircle2 className="size-3.5" /> Mark done</button>}
              </div>
            )}
            {a.followUpNote && <p className="mt-1 text-sm text-muted-foreground">{a.followUpNote}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">Reminders show on this page; email reminders aren't available yet.</p>
            {a.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm">{a.notes}</p>}

            <H>Resume</H>
            <div className="flex items-center justify-between text-sm">
              {resume ? <Link to="/resumes" search={{ id: resume.id }} className="inline-flex items-center gap-1.5 text-primary hover:underline"><FileText className="size-4" /> {resume.title}</Link> : <span className="text-muted-foreground">No resume linked</span>}
              <Link to="/resumes" search={{}} className="text-xs font-medium text-primary hover:underline">Resume Builder</Link>
            </div>

            <H>Interview preparation</H>
            <Row k="Interview date">{a.interviewAt && new Date(a.interviewAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</Row>
            <div className="mt-2 flex gap-2"><Link to="/interviews" className={btn}><MessagesSquare className="size-4" /> Interview prep</Link><Link to="/calendar" className={btn}><CalendarDays className="size-4" /> Calendar</Link></div>

            <H>Timeline</H>
            {a.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Currently <b>{STAGE_LABEL[a.status]}</b>. Changes from now on will appear here.</p>
            ) : (
              <ol className="relative ml-2 space-y-3 border-l pl-4">
                {[...a.history].reverse().map((h, i) => (
                  <li key={i} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <p>{h.text}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(h.at)} · {h.by === "you" ? "Recorded by you" : "System"}</p>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
