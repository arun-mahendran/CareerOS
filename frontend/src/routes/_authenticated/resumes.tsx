import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Copy, Download, Eye, FileDown, FileText, Loader2, MoreHorizontal, Pencil, Plus, Save, Target, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Editor, SectionOrder, STEP_SECTIONS } from "@/components/resume/editor";
import { ResumePreview } from "@/components/resume/preview";
import { ResumeDocument } from "@/components/resume/resume-document";
import { inputCls } from "@/components/resume/fields";
import { jobCatalogQuery } from "@/lib/job-catalog";
import { profileQuery, savedJobsQuery } from "@/lib/user-data";
import { emptyResume, jobAlignment, normalize, qualityChecks, sectionDone, TEMPLATES, type ResumeData, type TemplateId } from "@/lib/resume/model";
import { createResume, deleteResume, resumesQuery, saveResume, type ResumeRecord } from "@/lib/resume/service";
import { exportDocx, exportPdf } from "@/lib/resume/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/resumes")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({ meta: [{ title: "Resume builder — CareerOS" }, { name: "description", content: "Build a professional resume, tailor it to a role and export it as PDF or Word." }, { property: "og:title", content: "Resume builder — CareerOS" }, { property: "og:description", content: "Build a professional resume, tailor it to a role and export it as PDF or Word." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ResumesPage,
});

const STEPS = ["Personal details", "Experience & projects", "Skills & education", "Design & preview", "Download"];
const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

function ResumesPage() {
  const { id } = Route.useSearch();
  return id ? <Workspace key={id} id={id} /> : <ResumeList />;
}

/* ───────────────────────── My resumes ───────────────────────── */

function ResumeList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery(profileQuery);
  const list = useQuery(resumesQuery);
  const catalog = useQuery(jobCatalogQuery);
  const jobs = catalog.data?.jobs ?? [];
  const [renaming, setRenaming] = useState<ResumeRecord | null>(null);
  const [deleting, setDeleting] = useState<ResumeRecord | null>(null);
  const open = (id: string) => navigate({ to: "/resumes", search: { id } });

  const create = useMutation({
    mutationFn: (r: Parameters<typeof createResume>[0]) => createResume(r),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["resumes"] }); open(r.id); },
    onError: () => toast.error("Couldn't create the resume. Try again."),
  });
  const newResume = () => {
    const role = profile?.target_role ?? "";
    create.mutate({ title: role ? `${role} resume` : "My resume", target_role: role, template: "ats", data: emptyResume({ name: profile?.full_name ?? null, email: profile?.email ?? null, role }) });
  };

  return (
    <>
      <PageHeader eyebrow="Resume builder" title="My resumes" sub="Keep one resume per target role, or tailor a copy to a specific job." right={<button onClick={newResume} disabled={create.isPending} className={btnPrimary}>{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New resume</button>} />
      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
      ) : list.isError ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><AlertCircle className="size-4 text-destructive" /> Couldn't load your resumes. <button className="font-medium underline" onClick={() => list.refetch()}>Retry</button></div>
      ) : !list.data?.length ? (
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-10 text-center shadow-soft">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><FileText className="size-5" /></span>
          <p className="mt-4 font-semibold">No resumes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start with your details from CareerOS and shape it section by section.</p>
          <button onClick={newResume} className={cn(btnPrimary, "mt-5")}><Plus className="size-4" /> Create your first resume</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((r) => {
            const data = normalize(r.data, emptyResume());
            const job = jobs.find((j) => j.id === r.target_job_id);
            return (
              <article key={r.id} className="group overflow-hidden rounded-xl border bg-card shadow-soft lift">
                <button onClick={() => open(r.id)} className="block h-40 w-full overflow-hidden border-b bg-muted/60 pt-4" aria-label={`Open ${r.title}`}>
                  <div className="pointer-events-none mx-auto w-[210mm] origin-top scale-[0.24]" style={{ marginBottom: "-75%" }}><ResumeDocument data={data} template={r.template} /></div>
                </button>
                <div className="flex items-start gap-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{job ? `Tailored · ${job.company}` : r.target_role || "General"} · {TEMPLATES.find((t) => t.id === r.template)?.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(r.updated_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label="Resume actions" className="rounded-md p-1.5 hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => open(r.id)}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRenaming(r)}><FileText className="size-4" /> Rename</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => create.mutate({ title: `${r.title} (copy)`, target_role: r.target_role, template: r.template, target_job_id: r.target_job_id, data })}><Copy className="size-4" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => exportDocx(data, r.template, r.title).catch(() => toast.error("Word export failed"))}><Download className="size-4" /> Download Word</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDeleting(r)} className="text-destructive focus:text-destructive"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <RenameDialog r={renaming} onClose={() => setRenaming(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle><AlertDialogDescription>This permanently removes the resume. Your other resumes aren't affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!deleting) return;
              try { await deleteResume(deleting.id); qc.invalidateQueries({ queryKey: ["resumes"] }); toast.success("Resume deleted"); } catch { toast.error("Couldn't delete. Try again."); }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RenameDialog({ r, onClose }: { r: ResumeRecord | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  useEffect(() => { if (r) { setTitle(r.title); setRole(r.target_role ?? ""); } }, [r]);
  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Rename resume</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!r || !title.trim()) return;
          try { await saveResume(r.id, { title: title.trim(), target_role: role.trim() || null }); qc.invalidateQueries({ queryKey: ["resumes"] }); toast.success("Renamed"); onClose(); } catch { toast.error("Couldn't rename. Try again."); }
        }}>
          <label className="block text-xs font-medium">Resume name<input className={cn(inputCls, "mt-1.5")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
          <label className="block text-xs font-medium">Target role<input className={cn(inputCls, "mt-1.5")} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend Developer" /></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className={btn}>Cancel</button><button className={btnPrimary}>Save</button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Editor workspace ───────────────────────── */

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function Workspace({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery(resumesQuery);
  const record = list.data?.find((r) => r.id === id);

  if (list.isLoading) return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-[70vh] rounded-xl" /><Skeleton className="h-[70vh] rounded-xl" /></div>;
  if (!record) return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
      <p className="font-semibold">Resume not found</p>
      <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
      <button className={cn(btnPrimary, "mt-4")} onClick={() => { qc.invalidateQueries({ queryKey: ["resumes"] }); navigate({ to: "/resumes", search: {} }); }}>Back to my resumes</button>
    </div>
  );
  return <EditorWorkspace record={record} />;
}

function EditorWorkspace({ record }: { record: ResumeRecord }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [data, setData] = useState<ResumeData>(() => normalize(record.data, emptyResume()));
  const [template, setTemplate] = useState<TemplateId>(record.template);
  const [jobId, setJobId] = useState<string | null>(record.target_job_id);
  const [step, setStep] = useState(0);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const docRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ data, template, jobId });
  latest.current = { data, template, jobId };

  const set = useCallback((fn: (d: ResumeData) => ResumeData) => { setData(fn); setSave("dirty"); }, []);
  const role = data.personal.title || record.target_role || "";

  const persist = useCallback(async () => {
    setSave("saving");
    try {
      const { data: d, template: t, jobId: j } = latest.current;
      await saveResume(record.id, { data: d, template: t, target_job_id: j });
      setSave("saved");
      qc.invalidateQueries({ queryKey: ["resumes"] });
    } catch {
      setSave("error");
    }
  }, [record.id, qc]);

  // Autosave 1.2s after the last change.
  useEffect(() => {
    if (save !== "dirty") return;
    const t = setTimeout(persist, 1200);
    return () => clearTimeout(t);
  }, [save, data, template, jobId, persist]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save === "dirty" || save === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  const done = sectionDone(data);
  const stepDone = [
    (done.personal + done.summary) / 2,
    Math.max(done.experience, done.projects),
    (done.skills + done.education) / 2,
    1,
    1,
  ];
  const progress = Math.round((100 * stepDone.slice(0, 3).reduce((a, b) => a + b, 0)) / 3);

  async function downloadPdf() {
    if (!docRef.current) return;
    try { await exportPdf(docRef.current, template, record.title); toast.message("In the print window, choose “Save as PDF” as the destination."); } catch { toast.error("Couldn't open the PDF export. Try again."); }
  }
  async function downloadDocx() {
    try { await exportDocx(data, template, record.title); toast.success("Word document downloaded"); } catch { toast.error("Word export failed. Try again."); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Resume builder"
        title="Resume Builder"
        sub="Build a professional resume, tailor it to your target role, and export it when you're ready."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator state={save} onRetry={persist} />
            <button className={btn} onClick={() => navigate({ to: "/resumes", search: {} })}><ChevronLeft className="size-4" /> My resumes</button>
            <button className={btn} onClick={persist} disabled={save === "saving"}><Save className="size-4" /> Save</button>
            <button className={cn(btn, "hidden md:inline-flex xl:hidden")} onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Preview</button>
            <button className={btnPrimary} onClick={downloadPdf}><FileDown className="size-4" /> Download PDF</button>
          </div>
        }
      />

      {/* Step bar */}
      <div className="-mt-4 mb-6 rounded-xl border bg-card p-3 shadow-soft">
        <div className="flex items-center justify-between px-1 pb-2 text-xs text-muted-foreground"><span>{record.title}</span><span>{progress}% complete</span></div>
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        <ol className="grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors", i === step ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums", stepDone[i]! >= 1 && i < 3 ? "border-success bg-success text-primary-foreground" : i === step ? "border-primary text-primary" : "")}>
                  {stepDone[i]! >= 1 && i < 3 ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="hidden truncate lg:inline">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Mobile switch */}
      <div className="mb-4 grid grid-cols-2 rounded-lg border bg-card p-1 md:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} onClick={() => setMobileView(v)} className={cn("rounded-md py-1.5 text-sm", mobileView === v && "bg-accent font-medium text-accent-foreground")}>{v === "edit" ? "Edit resume" : "Preview resume"}</button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] xl:grid-cols-[48fr_52fr]">
        <div className={cn("min-w-0 space-y-4", mobileView === "preview" && "hidden md:block")}>
          {step < 3 && <Editor key={step} data={data} set={set} step={step} role={role} />}
          {step === 3 && <DesignStep data={data} set={set} template={template} setTemplate={(t) => { setTemplate(t); setSave("dirty"); }} jobId={jobId} setJobId={(j) => { setJobId(j); setSave("dirty"); }} />}
          {step === 4 && <DownloadStep data={data} onPdf={downloadPdf} onDocx={downloadDocx} />}
          <div className="flex justify-between pt-2">
            <button className={btn} disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="size-4" /> Back</button>
            {step < STEPS.length - 1 && <button className={btnPrimary} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]} <ChevronRight className="size-4" /></button>}
          </div>
        </div>
        <div className={cn("min-w-0", mobileView === "edit" && "hidden md:block")}>
          <div className="sticky top-20 h-[calc(100vh-6.5rem)] min-h-[520px]">
            <ResumePreview ref={docRef} data={data} template={template} />
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[92vh] max-w-4xl p-0">
          <DialogTitle className="sr-only">Resume preview</DialogTitle>
          <div className="h-full pt-10"><ResumePreview data={data} template={template} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="size-3.5" /> Saved</span>;
  if (state === "dirty") return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CircleDashed className="size-3.5" /> Unsaved changes</span>;
  if (state === "error") return <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline"><AlertCircle className="size-3.5" /> Save failed — retry</button>;
  return null;
}

/* ───────────────────────── Step 4: design & tailoring ───────────────────────── */

function DesignStep({ data, set, template, setTemplate, jobId, setJobId }: { data: ResumeData; set: (fn: (d: ResumeData) => ResumeData) => void; template: TemplateId; setTemplate: (t: TemplateId) => void; jobId: string | null; setJobId: (j: string | null) => void }) {
  const { data: saved } = useQuery(savedJobsQuery);
  const catalog = useQuery(jobCatalogQuery);
  const savedIds = new Set((saved ?? []).map((s) => s.job_id));
  const jobs = [...(catalog.data?.jobs ?? [])].sort((a, b) => Number(savedIds.has(b.id)) - Number(savedIds.has(a.id)));
  const job = jobs.find((j) => j.id === jobId);
  const align = useMemo(() => (job ? jobAlignment(data, job) : null), [data, job]);
  const q = useMemo(() => qualityChecks(data), [data]);
  const ex = new Set(data.exclude ?? []);
  const toggleEx = (id: string) => set((d) => { const s = new Set(d.exclude ?? []); s.has(id) ? s.delete(id) : s.add(id); return { ...d, exclude: [...s] }; });

  return (
    <div className="space-y-4">
      <Card title="Template" sub="Switch any time — your content stays the same.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTemplate(t.id)} aria-pressed={template === t.id} className={cn("rounded-lg border p-2 text-left transition-all", template === t.id ? "border-primary ring-2 ring-primary/25" : "hover:border-foreground/20")}>
              <div className="h-24 overflow-hidden rounded border bg-muted/50">
                <div className="pointer-events-none w-[210mm] origin-top-left scale-[0.15]"><ResumeDocument data={data} template={t.id} /></div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium">{template === t.id && <Check className="size-3 text-primary" />}{t.name}</p>
              <p className="text-[11px] text-muted-foreground">{t.hint}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Section order" sub="Move sections to put your strongest material first.">
        <SectionOrder data={data} set={set} />
      </Card>

      <Card title="Tailor resume to a job" sub="Compares this resume with the skills a job lists. It never adds skills for you." icon={Target}>
        <select value={jobId ?? ""} onChange={(e) => setJobId(e.target.value || null)} className={inputCls}>
          <option value="">General resume for {data.personal.title || "my target role"}</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{savedIds.has(j.id) ? "★ " : ""}{j.company} — {j.title}</option>)}
        </select>
        {job && align && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
              <p className="text-3xl font-semibold tabular-nums">{align.pct}%</p>
              <p className="text-xs text-muted-foreground">Job alignment: {align.present.length} of the {job.skills.length} skills {job.company} lists appear in your resume text. This is a keyword check, not a chance of being hired.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Chips label="Already in your resume" items={align.present} tone="ok" empty="None yet" />
              <Chips label="Listed by employer, not in your resume" items={align.missing} tone="miss" empty="All covered" />
            </div>
            {align.missing.length > 0 && <p className="text-xs text-muted-foreground">Add a missing skill only if you genuinely have it — ideally with a project or experience that shows it.</p>}
            {(data.projects.length > 0 || data.experience.length > 0) && (
              <div>
                <p className="mb-2 text-xs font-medium">Choose what to include in this version</p>
                <ul className="divide-y rounded-lg border text-sm">
                  {[...data.experience.map((e) => ({ id: e.id, label: e.title || "Untitled position", rel: align.experience.includes(e) })), ...data.projects.map((p) => ({ id: p.id, label: p.name || "Untitled project", rel: align.projects.includes(p) }))].map((it) => (
                    <li key={it.id}><label className="flex items-center gap-2 px-3 py-2"><input type="checkbox" checked={!ex.has(it.id)} onChange={() => toggleEx(it.id)} /><span className="flex-1">{it.label}</span>{it.rel && <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Relevant</span>}</label></li>
                  ))}
                </ul>
                <button className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => set((d) => ({ ...d, projects: [...d.projects].sort((a, b) => Number(align.projects.includes(b)) - Number(align.projects.includes(a))) }))}>Put relevant projects first</button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Resume quality" sub="Formatting and completeness checks — separate from job alignment above.">
        <div className="mb-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${q.score}%` }} /></div><span className="text-xs tabular-nums text-muted-foreground">{q.tips.filter((t) => t.ok).length}/{q.tips.length} checks</span></div>
        <ul className="space-y-1.5 text-sm">
          {[...q.tips].sort((a, b) => Number(a.ok) - Number(b.ok)).map((t) => (
            <li key={t.text} className="flex items-start gap-2">{t.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />}<span className={cn(t.ok && "text-muted-foreground")}>{t.text}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">These checks help readability; no tool can guarantee how an employer's screening system will score a resume.</p>
      </Card>
    </div>
  );
}

function Card({ title, sub, children, icon: Icon }: { title: string; sub?: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-start gap-2">{Icon && <Icon className="mt-0.5 size-4 text-primary" />}<div><h2 className="text-sm font-semibold">{title}</h2>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div></div>
      {children}
    </section>
  );
}

function Chips({ label, items, tone, empty }: { label: string; items: string[]; tone: "ok" | "miss"; empty: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? items.map((s) => <span key={s} className={cn("rounded-md border px-2 py-0.5 text-xs", tone === "ok" ? "border-success/20 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>{s}</span>) : <span className="text-xs text-muted-foreground">{empty}</span>}
      </div>
    </div>
  );
}

/* ───────────────────────── Step 5: download ───────────────────────── */

function DownloadStep({ data, onPdf, onDocx }: { data: ResumeData; onPdf: () => void; onDocx: () => void }) {
  const q = qualityChecks(data);
  const open = q.tips.filter((t) => !t.ok);
  return (
    <div className="space-y-4">
      {open.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium">{open.length} suggestion{open.length > 1 ? "s" : ""} before you download</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">{open.slice(0, 3).map((t) => <li key={t.text}>{t.text}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={onPdf} className="rounded-xl border bg-card p-5 text-left shadow-soft lift">
          <FileDown className="size-5 text-primary" />
          <p className="mt-3 font-medium">Download PDF</p>
          <p className="mt-1 text-xs text-muted-foreground">A4, selectable text and working links. Opens your browser's print window — pick “Save as PDF”.</p>
        </button>
        <button onClick={onDocx} className="rounded-xl border bg-card p-5 text-left shadow-soft lift">
          <FileText className="size-5 text-primary" />
          <p className="mt-3 font-medium">Download Word (.docx)</p>
          <p className="mt-1 text-xs text-muted-foreground">Editable in Microsoft Word, Google Docs and LibreOffice. Layout follows your template's fonts and headings.</p>
        </button>
      </div>
    </div>
  );
}
