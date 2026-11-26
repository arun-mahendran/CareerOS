import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bookmark, BookmarkCheck, Briefcase, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Code2, Flag, History,
  Lightbulb, Loader2, MessagesSquare, PlayCircle, RotateCcw, Sparkles, Target, UserRound,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { profileQuery, savedJobsQuery } from "@/lib/user-data";
import { jobCatalogQuery } from "@/lib/job-catalog";
import { ROLE_NAMES, findRoadmap } from "@/lib/roadmap/catalog";
import { ROLE_REQUIREMENTS, analyze, userSkillsQuery } from "@/lib/skills/model";
import { COACH, TYPE_LABEL, pickQuestions, shuffle, type Difficulty, type InterviewType, type Question } from "@/lib/interview/bank";
import { createSession, sessionsQuery, updateSession, type Answer, type Feedback, type Session } from "@/lib/interview/sessions";
import { evaluateAnswer, modelAnswer } from "@/lib/interview/coach.functions";
import { ai, USE_API } from "@/services/backend";
import { cn } from "@/lib/utils";

type Search = { job?: string; company?: string };

export const Route = createFileRoute("/_authenticated/interviews")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["job"] === "string" ? { job: s["job"] } : {}),
    ...(typeof s["company"] === "string" ? { company: s["company"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Interview preparation — CareerOS" },
      { name: "description", content: "Practice role-specific technical, HR and company interview questions with structured coaching." },
      { property: "og:title", content: "Interview preparation — CareerOS" },
      { property: "og:description", content: "Practice role-specific technical, HR and company interview questions with structured coaching." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Interviews,
});

const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
const field = "h-9 w-full rounded-lg border bg-card px-3 text-sm";

const MODES: { id: InterviewType; icon: typeof Code2; desc: string }[] = [
  { id: "technical", icon: Code2, desc: "Programming, DSA, databases, frameworks and system design." },
  { id: "hr", icon: UserRound, desc: "Behavioral, motivation, strengths and project stories." },
  { id: "role", icon: Target, desc: "A mix built from your target role's required skills." },
  { id: "company", icon: Building2, desc: "Questions framed around a company and its role." },
];

type View = { kind: "home" } | { kind: "session"; id: string } | { kind: "report"; id: string } | { kind: "history" };

function Interviews() {
  const search = Route.useSearch();
  const profile = useQuery(profileQuery);
  const sessionsQ = useQuery(sessionsQuery);
  const [view, setView] = useState<View>({ kind: "home" });
  const role = findRoadmap(profile.data?.target_role)?.role ?? null;

  if (profile.isLoading || sessionsQ.isLoading) return <div className="space-y-6"><Skeleton className="h-24 w-2/3" /><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;

  const sessions = sessionsQ.data ?? [];
  const current = "id" in view ? sessions.find((s) => s.id === view.id) : undefined;

  if (view.kind === "session" && current) return <Workspace s={current} role={role} onExit={() => setView({ kind: "home" })} onFinish={() => setView({ kind: "report", id: current.id })} />;
  if (view.kind === "report" && current) return <Report s={current} onReview={() => setView({ kind: "session", id: current.id })} onHome={() => setView({ kind: "home" })} onStarted={(id) => setView({ kind: "session", id })} />;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="eyebrow">Interview preparation</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Get interview-ready with confidence</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Practice role-specific questions, improve your answers, and identify the topics you should revise before your next interview.</p>
          {role && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs"><Target className="size-3 text-primary" /> Preparing for: <span className="font-medium">{role}</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {sessions.length > 0 && <button className={btn} onClick={() => setView(view.kind === "history" ? { kind: "home" } : { kind: "history" })}><History className="size-3.5" /> {view.kind === "history" ? "Back to setup" : "View previous sessions"}</button>}
          <a href="#setup" className={btnPrimary} onClick={() => setView({ kind: "home" })}><PlayCircle className="size-3.5" /> Start mock interview</a>
        </div>
      </div>

      {view.kind === "history"
        ? <HistoryList sessions={sessions} onOpen={(s) => setView(s.status === "completed" ? { kind: "report", id: s.id } : { kind: "session", id: s.id })} onStarted={(id) => setView({ kind: "session", id })} />
        : <Setup role={role} search={search} onStarted={(id) => setView({ kind: "session", id })} recent={sessions.slice(0, 3)} onOpen={(s) => setView(s.status === "completed" ? { kind: "report", id: s.id } : { kind: "session", id: s.id })} />}
    </>
  );
}

// ---------------- Setup ----------------

function Setup({ role, search, onStarted, recent, onOpen }: { role: string | null; search: Search; onStarted: (id: string) => void; recent: Session[]; onOpen: (s: Session) => void }) {
  const qc = useQueryClient();
  const skillsQ = useQuery(userSkillsQuery);
  const savedQ = useQuery(savedJobsQuery);
  const catalog = useQuery(jobCatalogQuery);
  const jobs = catalog.data?.jobs ?? [];
  const companies = catalog.data?.companies ?? [];
  const presetJob = search.job ? jobs.find((j) => j.id === search.job) : undefined;
  const presetCompany = search.company ?? presetJob?.company;
  const [type, setType] = useState<InterviewType>(presetCompany ? "company" : "technical");
  const [targetRole, setTargetRole] = useState(role ?? ROLE_NAMES[0]!);
  const [company, setCompany] = useState(presetCompany ?? "");
  const [jobId, setJobId] = useState<string>(presetJob?.id ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermediate");
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"guided" | "mock">("guided");

  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const reqSkills = job ? job.skills : (ROLE_REQUIREMENTS[targetRole] ?? []).map((r) => r.skill);
  const weak = useMemo(() => analyze(ROLE_REQUIREMENTS[targetRole] ?? [], skillsQ.data ?? [], targetRole, "role").filter((a) => a.priority > 0).sort((a, b) => b.priority - a.priority).map((a) => a.skill), [targetRole, skillsQ.data]);
  const savedIds = new Set((savedQ.data ?? []).map((s) => s.job_id));
  const jobOptions = jobs.filter((j) => type !== "company" || j.company === company);
  const companyJobs = jobs.filter((j) => j.company === company);

  const start = useMutation({
    mutationFn: async () => {
      const co = companies.find((c) => c.name === company);
      const questions = pickQuestions({ type, skills: reqSkills, prioritySkills: weak, difficulty, count, ...(topic ? { topic } : {}), company: type === "company" && co ? { name: co.name, about: co.about } : null });
      if (!questions.length) throw new Error("empty");
      return createSession({ interview_type: type, target_role: targetRole, company: type === "company" ? company : null, job_id: jobId || null, difficulty, practice_mode: mode, questions });
    },
    onSuccess: (s) => { qc.setQueryData<Session[]>(["interview_sessions"], (d = []) => [s, ...d]); onStarted(s.id); },
    onError: (e) => toast.error(e instanceof Error && e.message === "empty" ? "No questions match these settings. Try another topic or difficulty." : "Couldn't start the session. Please try again."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => { setType(m.id); setTopic(""); }} aria-pressed={type === m.id}
              className={cn("rounded-xl border bg-card p-4 text-left transition hover:border-primary/30", type === m.id && "border-primary bg-primary/5 ring-1 ring-primary/20")}>
              <m.icon className={cn("size-4", type === m.id ? "text-primary" : "text-muted-foreground")} />
              <p className="mt-2 text-sm font-semibold">{TYPE_LABEL[m.id].replace(" interview", "").replace("preparation", "prep")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </section>

        <section id="setup" className="scroll-mt-24 rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="text-base font-semibold">Session setup</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {type !== "hr" && (
              <L label="Target role">
                <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className={field}>{ROLE_NAMES.map((r) => <option key={r}>{r}</option>)}</select>
              </L>
            )}
            {type === "company" && (
              <L label="Company">
                <select value={company} onChange={(e) => { setCompany(e.target.value); setJobId(""); }} className={field}>
                  <option value="">{companies.length ? "Select a company" : "No synced companies available"}</option>
                  {companies.map((c) => <option key={c.slug}>{c.name}</option>)}
                </select>
              </L>
            )}
            {(type === "role" || type === "company") && (
              <L label={type === "company" ? "Job at this company (optional)" : "Prepare for a job (optional)"}>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={field}>
                  <option value="">{type === "company" && !companyJobs.length ? "No listings for this company" : "Use role requirements"}</option>
                  {jobOptions.map((j) => <option key={j.id} value={j.id}>{savedIds.has(j.id) ? "★ " : ""}{j.title} — {j.company}</option>)}
                </select>
              </L>
            )}
            {type === "technical" && (
              <L label="Preferred topic">
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                  <option value="">Mix of my role's skills</option>
                  {reqSkills.map((s) => <option key={s} value={s}>{s}{weak.includes(s) ? " · weak skill" : ""}</option>)}
                </select>
              </L>
            )}
            {type !== "hr" && (
              <L label="Difficulty">
                <Seg value={difficulty} onChange={setDifficulty} options={["Beginner", "Intermediate", "Advanced"]} />
              </L>
            )}
            <L label="Number of questions"><Seg value={String(count)} onChange={(v) => setCount(Number(v))} options={["5", "10", "15"]} /></L>
            <L label="Practice mode">
              <Seg value={mode} onChange={setMode} options={["guided", "mock"]} labels={{ guided: "Guided practice", mock: "Mock interview" }} />
            </L>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "guided" ? "Guided: hints and suggested answers are available as you go." : "Mock: one question at a time; suggested answers unlock only after you answer."}
            {type === "company" && " Company questions are general practice, not questions this company is known to ask."}
          </p>
          <div className="mt-5 flex justify-end">
            <button className={btnPrimary} disabled={start.isPending || (type === "company" && !company)} onClick={() => start.mutate()}>
              {start.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />} Start session
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <Panel title="Suggested topics" icon={<Lightbulb className="size-3.5" />}>
          {weak.length ? (
            <>
              <p className="text-xs text-muted-foreground">Your weakest skills for {targetRole}:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {weak.slice(0, 5).map((s) => <button key={s} onClick={() => { setType("technical"); setTopic(s); }} className="rounded-full border px-2.5 py-0.5 text-xs hover:border-primary/40 hover:text-primary">{s}</button>)}
              </div>
              <Link to="/roadmap" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Review these on your roadmap →</Link>
            </>
          ) : <p className="text-xs text-muted-foreground"><Link to="/skills" className="font-medium text-primary hover:underline">Rate your skills</Link> to get practice topics based on your gaps.</p>}
        </Panel>
        <Panel title="Before you practise" icon={<Briefcase className="size-3.5" />}>
          <ul className="space-y-1.5 text-xs">
            <li><Link to="/resumes" className="text-primary hover:underline">Review your resume</Link> <span className="text-muted-foreground">— interviewers ask about it.</span></li>
            {job && <li><Link to="/jobs/$jobId" params={{ jobId: job.id }} className="text-primary hover:underline">Re-read the {job.company} listing</Link></li>}
            <li><Link to="/companies" className="text-primary hover:underline">Research the company</Link></li>
          </ul>
        </Panel>
        <Panel title="Recent sessions" icon={<History className="size-3.5" />}>
          {recent.length ? (
            <ul className="space-y-2">{recent.map((s) => (
              <li key={s.id}><button onClick={() => onOpen(s)} className="w-full text-left text-xs hover:text-primary">
                <span className="font-medium">{TYPE_LABEL[s.interview_type]}</span><br />
                <span className="text-muted-foreground">{answeredCount(s)}/{s.questions.length} answered · {s.status === "completed" ? "Completed" : "In progress"}</span>
              </button></li>
            ))}</ul>
          ) : <p className="text-xs text-muted-foreground">Your practice history will appear here after you complete your first interview session.</p>}
        </Panel>
      </aside>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;
}
function Seg<V extends string>({ value, onChange, options, labels }: { value: V; onChange: (v: V) => void; options: V[]; labels?: Partial<Record<V, string>> }) {
  return (
    <div className="flex rounded-lg border bg-background p-0.5 text-sm">
      {options.map((o) => <button type="button" key={o} onClick={() => onChange(o)} className={cn("flex-1 rounded-md px-2 py-1", value === o ? "bg-card font-medium shadow-soft" : "text-muted-foreground")}>{labels?.[o] ?? o}</button>)}
    </div>
  );
}
function Panel({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-soft", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{icon}{title}</p>
      {children}
    </div>
  );
}

const answeredCount = (s: Session) => s.questions.filter((q) => s.answers[q.id]?.text.trim()).length;

// ---------------- Workspace ----------------

type Model = { key_points: string[]; example: string; why: string; mistakes: string[]; follow_ups: string[] };

function Workspace({ s, role, onExit, onFinish }: { s: Session; role: string | null; onExit: () => void; onFinish: () => void }) {
  const qc = useQueryClient();
  const evalServer = useServerFn(evaluateAnswer);
  const modelServer = useServerFn(modelAnswer);
  const evalFn = (a: Parameters<typeof evalServer>[0]) => (USE_API ? ai.interviewFeedback(a!.data as object) : evalServer(a));
  const modelFn = (a: Parameters<typeof modelServer>[0]) => (USE_API ? ai.interviewModelAnswer(a!.data as object) : modelServer(a));
  const [idx, setIdx] = useState(Math.min(s.current_index, s.questions.length - 1));
  const [answers, setAnswers] = useState<Record<string, Answer>>(s.answers ?? {});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(s.feedback ?? {});
  const [models, setModels] = useState<Record<string, Model>>({});
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | "idle">("idle");
  const [clearOpen, setClearOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  latest.current = answers;

  const q = s.questions[idx]!;
  const a = answers[q.id];
  const coach = COACH[q.kind];
  const words = a?.text.trim() ? a.text.trim().split(/\s+/).length : 0;
  const attempted = !!a?.text.trim() && words >= 5;

  const persist = async (patch: Parameters<typeof updateSession>[1]) => {
    setSaveState("saving");
    try {
      await updateSession(s.id, patch);
      setSaveState("saved");
      qc.setQueryData<Session[]>(["interview_sessions"], (d = []) => d.map((x) => (x.id === s.id ? { ...x, ...patch } as Session : x)));
    } catch { setSaveState("error"); }
  };
  const queueSave = (next: Record<string, Answer>) => {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("idle");
    timer.current = setTimeout(() => void persist({ answers: next }), 1200);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const setA = (patch: Partial<Answer>, immediate = false) => {
    const next = { ...latest.current, [q.id]: { text: "", ...latest.current[q.id], ...patch, saved_at: new Date().toISOString() } };
    setAnswers(next);
    if (immediate) { if (timer.current) clearTimeout(timer.current); void persist({ answers: next }); } else queueSave(next);
  };
  const go = (n: number) => {
    if (timer.current) { clearTimeout(timer.current); void persist({ answers: latest.current, current_index: n }); }
    else void updateSession(s.id, { current_index: n }).catch(() => undefined);
    setIdx(n); setAiErr(null); setNavOpen(false);
  };

  const evaluate = useMutation({
    mutationFn: async () => {
      const r = await evalFn({ data: { question: q.text, kind: q.kind, topic: q.topic, ...(role ? { role } : {}), answer: a!.text } });
      if (!r.ok) throw new Error(r.error);
      return r.data as unknown as Feedback;
    },
    onMutate: () => setAiErr(null),
    onSuccess: (f) => { const next = { ...feedback, [q.id]: f }; setFeedback(next); void persist({ feedback: next, answers: latest.current }); },
    onError: (e) => setAiErr(e instanceof Error ? e.message : "Couldn't get feedback."),
  });
  const reveal = useMutation({
    mutationFn: async () => {
      const r = await modelFn({ data: { question: q.text, kind: q.kind, topic: q.topic, ...(role ? { role } : {}) } });
      if (!r.ok) throw new Error(r.error);
      return r.data as unknown as Model;
    },
    onMutate: () => setAiErr(null),
    onSuccess: (m) => setModels((x) => ({ ...x, [q.id]: m })),
    onError: (e) => setAiErr(e instanceof Error ? e.message : "Couldn't load a suggested answer."),
  });

  const finish = async () => {
    await persist({ answers: latest.current, status: "completed", current_index: idx });
    onFinish();
  };

  const canReveal = s.practice_mode === "guided" || attempted;
  const fb = feedback[q.id];
  const model = models[q.id];
  const progressPct = Math.round((100 * s.questions.filter((x) => answers[x.id]?.text.trim()).length) / s.questions.length);

  const Navigator = (
    <ol className="space-y-1">
      {s.questions.map((x, i) => {
        const ans = !!answers[x.id]?.text.trim();
        const rev = !!answers[x.id]?.revision;
        return (
          <li key={x.id}>
            <button onClick={() => go(i)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition", i === idx ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
              <span className="w-5 font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate">{x.topic}</span>
              {rev && <Flag className="size-3 text-warning" aria-label="Marked for revision" />}
              {ans ? <Check className="size-3 text-success" aria-label="Answered" /> : <span className="size-2 rounded-full border" aria-label="Unanswered" />}
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => { if (timer.current) { clearTimeout(timer.current); void persist({ answers: latest.current }); } onExit(); }}><ChevronLeft className="size-4" /> Interview preparation</button>
        <span className="text-xs text-muted-foreground">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All answers saved" : saveState === "error" ? <span className="text-destructive">Couldn't save — your text is kept here. <button className="underline" onClick={() => void persist({ answers: latest.current })}>Retry</button></span> : "Autosaves as you type"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
        {/* Navigator */}
        <aside className="hidden lg:block">
          <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Questions</p>
          {Navigator}
        </aside>

        <div className="min-w-0">
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="font-semibold tracking-widest text-muted-foreground uppercase">{TYPE_LABEL[s.interview_type]}{s.company ? ` · ${s.company}` : ""}</p>
              <button className="rounded-lg border px-2 py-1 lg:hidden" onClick={() => setNavOpen((o) => !o)}>Question {idx + 1} of {s.questions.length} <ChevronDown className="inline size-3" /></button>
            </div>
            {navOpen && <div className="mt-2 rounded-xl border bg-card p-2 lg:hidden">{Navigator}</div>}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} /></div>
          </div>

          <section key={q.id} className="animate-rise rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground">QUESTION {String(idx + 1).padStart(2, "0")} OF {String(s.questions.length).padStart(2, "0")}</p>
              <div className="flex gap-1">
                <IconToggle on={!!a?.bookmarked} onClick={() => setA({ bookmarked: !a?.bookmarked }, true)} label={a?.bookmarked ? "Saved question" : "Save question"} icon={a?.bookmarked ? BookmarkCheck : Bookmark} />
                <IconToggle on={!!a?.revision} onClick={() => setA({ revision: !a?.revision }, true)} label={a?.revision ? "Marked for revision" : "Mark for revision"} icon={Flag} />
              </div>
            </div>
            <h2 className="mt-2 text-lg leading-snug font-semibold md:text-xl">{q.text}</h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Topic: <span className="text-foreground">{q.topic}</span></span>
              <span>Difficulty: <span className="text-foreground">{q.difficulty}</span></span>
              <span>~{q.minutes} min answer</span>
            </div>
            {s.practice_mode === "guided" && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Focus:</span> {q.focus}</p>}

            <textarea value={a?.text ?? ""} onChange={(e) => setA({ text: e.target.value })} placeholder={coach.placeholder} rows={8}
              className="mt-5 min-h-44 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary/40 focus:ring-2 focus:ring-ring/20" aria-label="Your answer" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{words} word{words === 1 ? "" : "s"}</span>
              <div className="flex gap-2">
                <button className="hover:text-foreground disabled:opacity-40" disabled={!a?.text} onClick={() => setClearOpen(true)}>Clear answer</button>
                <button className={cn(btn, "text-xs")} onClick={() => setA({}, true)} disabled={!a?.text}>Save answer</button>
              </div>
            </div>

            {/* AI actions */}
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <button className={cn(btn, "text-xs")} disabled={!attempted || evaluate.isPending} onClick={() => evaluate.mutate()} title={attempted ? "" : "Write at least a few sentences first"}>
                {evaluate.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {fb ? "Get feedback again" : "Get practice feedback"}
              </button>
              <button className={cn(btn, "text-xs")} disabled={!canReveal || reveal.isPending || !!model} onClick={() => reveal.mutate()} title={canReveal ? "" : "Answer first to unlock in mock mode"}>
                {reveal.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />} {canReveal ? "Show suggested answer" : "Suggested answer unlocks after you answer"}
              </button>
            </div>
            {aiErr && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{aiErr}</p>}
            {fb && <FeedbackView f={fb} />}
            {model && <ModelView m={model} />}

            <div className="mt-6 flex items-center justify-between">
              <button className={btn} disabled={idx === 0} onClick={() => go(idx - 1)}><ChevronLeft className="size-4" /> Previous</button>
              {idx < s.questions.length - 1
                ? <button className={btnPrimary} onClick={() => go(idx + 1)}>Next question <ChevronRight className="size-4" /></button>
                : <button className={btnPrimary} onClick={() => void finish()}><Check className="size-4" /> Finish session</button>}
            </div>
          </section>
        </div>

        {/* Coach */}
        <aside>
          <div className="rounded-2xl border bg-card shadow-soft lg:sticky lg:top-20">
            <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setCoachOpen((o) => !o)} aria-expanded={coachOpen}>
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><MessagesSquare className="size-3.5" /> Interview coach</span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", coachOpen && "rotate-180")} />
            </button>
            {coachOpen && (
              <div className="space-y-4 border-t p-4">
                <div>
                  <p className="text-xs font-medium">Self-review</p>
                  <ul className="mt-2 space-y-1.5">
                    {coach.checklist.map((c) => {
                      const on = a?.checked?.includes(c) ?? false;
                      return (
                        <li key={c}>
                          <label className="flex cursor-pointer items-start gap-2 text-xs">
                            <input type="checkbox" checked={on} className="mt-0.5 accent-primary" onChange={() => setA({ checked: on ? (a?.checked ?? []).filter((x) => x !== c) : [...(a?.checked ?? []), c] }, true)} />
                            <span className={cn(on && "text-muted-foreground line-through")}>{c}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium">Recommended structure</p>
                  <ol className="mt-2 space-y-1 text-xs text-muted-foreground">{coach.structure.map((x, i) => <li key={x}><span className="mr-1.5 font-mono">{i + 1}.</span>{x}</li>)}</ol>
                </div>
                {q.skill && <Link to="/roadmap" className="block text-xs font-medium text-primary hover:underline">Revise {q.skill} on your roadmap →</Link>}
                <p className="text-[11px] text-muted-foreground">Feedback is AI practice coaching, not an employer assessment.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Clear this answer?</AlertDialogTitle><AlertDialogDescription>Your written answer for this question will be removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => setA({ text: "" }, true)}>Clear answer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IconToggle({ on, onClick, label, icon: I }: { on: boolean; onClick: () => void; label: string; icon: typeof Flag }) {
  return <button onClick={onClick} aria-pressed={on} aria-label={label} title={label} className={cn("grid size-8 place-items-center rounded-lg border transition hover:bg-muted", on && "border-primary/30 bg-primary/10 text-primary")}><I className="size-3.5" /></button>;
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items?.length) return null;
  return <div><p className={cn("text-xs font-semibold", tone)}>{title}</p><ul className="mt-1 space-y-1">{items.map((x) => <li key={x} className="flex gap-2 text-sm"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />{x}</li>)}</ul></div>;
}

function FeedbackView({ f }: { f: Feedback }) {
  return (
    <div className="mt-5 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase"><Sparkles className="size-3.5" /> Practice feedback</p>
      <Bullets title="What you explained well" items={f.strengths} tone="text-success" />
      <Bullets title="Missing or underdeveloped" items={f.missing} tone="text-destructive" />
      {f.clarity && <div><p className="text-xs font-semibold">Clarity & completeness</p><p className="mt-1 text-sm">{f.clarity}</p></div>}
      <Bullets title="Suggestions" items={f.suggestions} />
      <Bullets title="Improved structure" items={f.structure} />
      <Bullets title="Follow-up questions to practise" items={f.follow_ups} />
    </div>
  );
}

function ModelView({ m }: { m: Model }) {
  return (
    <div className="mt-5 space-y-3 rounded-xl border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Lightbulb className="size-3.5" /> Suggested answer guide</p>
      <Bullets title="Key points to mention" items={m.key_points} />
      {m.example && <div><p className="text-xs font-semibold">Example answer</p><p className="mt-1 text-sm whitespace-pre-line">{m.example}</p></div>}
      {m.why && <div><p className="text-xs font-semibold">Why this works</p><p className="mt-1 text-sm">{m.why}</p></div>}
      <Bullets title="Common mistakes" items={m.mistakes} />
      <Bullets title="Possible follow-ups" items={m.follow_ups} />
    </div>
  );
}

// ---------------- Report ----------------

function useRepeat(onStarted: (id: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { s: Session; questions: Question[] }) => createSession({ interview_type: p.s.interview_type, target_role: p.s.target_role, company: p.s.company, job_id: p.s.job_id, difficulty: p.s.difficulty, practice_mode: p.s.practice_mode, questions: p.questions }),
    onSuccess: (n) => { qc.setQueryData<Session[]>(["interview_sessions"], (d = []) => [n, ...d]); onStarted(n.id); },
    onError: () => toast.error("Couldn't start a new session."),
  });
}

function Report({ s, onReview, onHome, onStarted }: { s: Session; onReview: () => void; onHome: () => void; onStarted: (id: string) => void }) {
  const repeat = useRepeat(onStarted);
  const answered = s.questions.filter((q) => s.answers[q.id]?.text.trim());
  const topics = Array.from(new Set(s.questions.map((q) => q.topic)));
  const evaluated = s.questions.filter((q) => s.feedback[q.id]);
  const weak = s.questions.filter((q) => !s.answers[q.id]?.text.trim() || s.answers[q.id]?.revision || (s.feedback[q.id]?.missing.length ?? 0) > 1);
  const weakTopics = Array.from(new Set(weak.map((q) => q.topic)));
  const checks = s.questions.reduce((n, q) => n + (s.answers[q.id]?.checked?.length ?? 0), 0);
  const totalChecks = s.questions.filter((q) => s.answers[q.id]?.text.trim()).reduce((n, q) => n + COACH[q.kind].checklist.length, 0);

  return (
    <>
      <button className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={onHome}><ChevronLeft className="size-4" /> Interview preparation</button>
      <div className="mb-6">
        <p className="eyebrow">Session summary</p>
        <h1 className="mt-2 text-2xl font-bold">{TYPE_LABEL[s.interview_type]}{s.company ? ` · ${s.company}` : ""}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{s.target_role ?? "General"} · {s.difficulty} · {new Date(s.created_at).toLocaleDateString()}</p>
      </div>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Questions", s.questions.length], ["Answered", answered.length], ["Skipped", s.questions.length - answered.length], ["Got AI feedback", evaluated.length]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{v}</p></div>
        ))}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Topics practised" icon={<Code2 className="size-3.5" />}><div className="flex flex-wrap gap-1.5">{topics.map((t) => <span key={t} className="rounded-full border px-2.5 py-0.5 text-xs">{t}</span>)}</div></Panel>
        <Panel title="Practise next" icon={<Flag className="size-3.5" />}>
          {weakTopics.length ? <div className="flex flex-wrap gap-1.5">{weakTopics.map((t) => <span key={t} className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs">{t}</span>)}</div> : <p className="text-xs text-muted-foreground">Nothing flagged — every question was answered without revision marks.</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">Based on skipped questions, revision marks and gaps noted in feedback.</p>
        </Panel>
        <Panel title="Self-review" icon={<Check className="size-3.5" />}>
          <p className="text-sm">{totalChecks ? `You ticked ${checks} of ${totalChecks} checklist items on answered questions.` : "No checklist items were used in this session."}</p>
        </Panel>
        <Panel title="About this summary" icon={<Sparkles className="size-3.5" />}>
          <p className="text-xs text-muted-foreground">{evaluated.length ? `${evaluated.length} answer${evaluated.length > 1 ? "s" : ""} received AI practice feedback — review it per question.` : "No answers were evaluated, so there's no feedback summary."} There is no overall score: this is practice, not a prediction.</p>
        </Panel>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button className={btn} onClick={onReview}>Review answers</button>
        {weak.length > 0 && <button className={btn} disabled={repeat.isPending} onClick={() => repeat.mutate({ s, questions: shuffle(weak) })}><Flag className="size-3.5" /> Practise weak topics</button>}
        <button className={btnPrimary} disabled={repeat.isPending} onClick={() => repeat.mutate({ s, questions: shuffle(s.questions) })}><RotateCcw className="size-3.5" /> Start another session</button>
        <button className={btn} onClick={onHome}>Return to interview preparation</button>
      </div>
    </>
  );
}

// ---------------- History ----------------

function HistoryList({ sessions, onOpen, onStarted }: { sessions: Session[]; onOpen: (s: Session) => void; onStarted: (id: string) => void }) {
  const repeat = useRepeat(onStarted);
  if (!sessions.length) return <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-soft">Your practice history will appear here after you complete your first interview session.</div>;
  return (
    <div className="divide-y rounded-2xl border bg-card shadow-soft">
      {sessions.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{TYPE_LABEL[s.interview_type]}{s.company ? ` · ${s.company}` : ""}</p>
            <p className="text-xs text-muted-foreground">{s.target_role ?? "General"} · {new Date(s.created_at).toLocaleDateString()} · {answeredCount(s)}/{s.questions.length} answered</p>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.status === "completed" ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>{s.status === "completed" ? "Completed" : "In progress"}</span>
          <div className="flex gap-2">
            <button className={cn(btn, "text-xs")} onClick={() => onOpen(s)}>{s.status === "completed" ? "Review" : "Continue"}</button>
            <button className={cn(btn, "text-xs")} disabled={repeat.isPending} onClick={() => repeat.mutate({ s, questions: shuffle(s.questions) })}>Repeat</button>
          </div>
        </div>
      ))}
    </div>
  );
}
