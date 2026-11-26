// Application organizer data layer. Records live in the saved_jobs table
// (owner-only). Swap these functions for src/services/api.ts once the
// FastAPI server is hosted — the page only depends on this module.
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import { getUserId } from "@/lib/user-data";

export const STAGES = ["saved", "applied", "assessment", "interviewing", "offer", "rejected", "withdrawn"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { saved: "Saved", applied: "Applied", assessment: "Assessment", interviewing: "Interviewing", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
export const JOB_TYPES = ["Full-time", "Internship", "Part-time", "Contract"];

export type HistoryEvent = { at: string; text: string; by: "you" | "system" };

type Row = {
  id: string; job_id: string; status: string; created_at: string; updated_at: string | null;
  company: string | null; title: string | null; location: string | null; job_type: string | null;
  job_url: string | null; career_url: string | null; salary: string | null; notes: string | null;
  applied_on: string | null; follow_up_on: string | null; follow_up_done: boolean | null; follow_up_note: string | null;
  interview_at: string | null; resume_id: string | null; history: HistoryEvent[] | null;
};

export type Application = {
  id: string; jobId: string; fromCatalog: boolean; status: Stage;
  company: string; title: string; location: string; jobType: string;
  jobUrl: string; careerUrl: string; salary: string; notes: string;
  appliedOn: string; followUpOn: string; followUpDone: boolean; followUpNote: string;
  interviewAt: string; resumeId: string; history: HistoryEvent[];
  createdAt: string; updatedAt: string;
};

export type AppInput = Omit<Application, "id" | "fromCatalog" | "history" | "createdAt" | "updatedAt" | "jobId"> & { jobId?: string };

function fromRow(r: Row): Application {
  return {
    id: r.id, jobId: r.job_id, fromCatalog: false,
    status: (STAGES as readonly string[]).includes(r.status) ? (r.status as Stage) : "saved",
    company: r.company ?? "Company not recorded",
    title: r.title ?? "Role not recorded",
    location: r.location ?? "",
    jobType: r.job_type ?? "",
    jobUrl: r.job_url ?? "",
    careerUrl: r.career_url ?? "",
    salary: r.salary ?? "",
    notes: r.notes ?? "", appliedOn: r.applied_on ?? "", followUpOn: r.follow_up_on ?? "",
    followUpDone: !!r.follow_up_done, followUpNote: r.follow_up_note ?? "",
    interviewAt: r.interview_at ? r.interview_at.slice(0, 16) : "", resumeId: r.resume_id ?? "",
    history: r.history ?? [], createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
  };
}

const t = () => db.from("saved_jobs");

export const applicationsQuery = queryOptions({
  queryKey: ["saved_jobs", "applications"],
  queryFn: async (): Promise<Application[]> => {
    const { data, error } = await t().select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(fromRow);
  },
});

const toRow = (a: Partial<AppInput>) => {
  const o: Record<string, unknown> = {};
  const map: [keyof AppInput, string][] = [["status", "status"], ["company", "company"], ["title", "title"], ["location", "location"], ["jobType", "job_type"], ["jobUrl", "job_url"], ["careerUrl", "career_url"], ["salary", "salary"], ["notes", "notes"], ["appliedOn", "applied_on"], ["followUpOn", "follow_up_on"], ["followUpDone", "follow_up_done"], ["followUpNote", "follow_up_note"], ["interviewAt", "interview_at"], ["resumeId", "resume_id"]];
  for (const [k, col] of map) if (k in a) { const v = a[k]; o[col] = v === "" ? null : v; }
  return o;
};

const ev = (text: string, by: HistoryEvent["by"] = "you"): HistoryEvent => ({ at: new Date().toISOString(), text, by });

export async function createApplication(a: AppInput) {
  const user_id = await getUserId();
  const job_id = a.jobId || `ext-${crypto.randomUUID()}`;
  const { error } = await t().insert({ user_id, job_id, ...toRow(a), history: [ev(`Application added as ${STAGE_LABEL[a.status]}`)] });
  if (error) throw error.code === "23505" ? new Error("This job is already in your applications.") : error;
}

export async function updateApplication(cur: Application, patch: Partial<AppInput>, note?: string) {
  const events = [...cur.history];
  if (patch.status && patch.status !== cur.status) events.push(ev(`Status changed to ${STAGE_LABEL[patch.status]}`));
  if (patch.followUpDone && !cur.followUpDone) events.push(ev("Follow-up marked as done"));
  if (patch.followUpOn && patch.followUpOn !== cur.followUpOn) events.push(ev(`Follow-up set for ${fmtDate(patch.followUpOn)}`));
  if (note) events.push(ev(note));
  const { error } = await t().update({ ...toRow(patch), history: events, updated_at: new Date().toISOString() }).eq("id", cur.id);
  if (error) throw error;
}

export async function deleteApplication(id: string) {
  const { error } = await t().delete().eq("id", id);
  if (error) throw error;
}

export function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

/** Follow-up state from the user's own date; null when no date is set. */
export function followUpState(a: Application): "overdue" | "today" | "upcoming" | "later" | "done" | null {
  if (!a.followUpOn) return null;
  if (a.followUpDone) return "done";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${a.followUpOn}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 3 ? "upcoming" : "later";
}
