import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import { getUserId } from "@/lib/user-data";
import { ACTIVITIES, type Activity, type RoleRoadmap } from "./catalog";

export type ItemStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type ProgressRow = { step_id: string; status: Exclude<ItemStatus, "not_started">; completed_at: string | null };
export type Prefs = { weekly_hours: number; pace: "relaxed" | "steady" | "intensive"; skill_level: "beginner" | "intermediate" | "advanced"; target_date: string | null; priority_skills: string[] };
export type StudyLog = { step_id: string; minutes: number; logged_on: string };

export const DEFAULT_PREFS: Prefs = { weekly_hours: 6, pace: "steady", skill_level: "beginner", target_date: null, priority_skills: [] };

export const roadmapProgressQuery = queryOptions({
  queryKey: ["roadmap_progress_full"],
  queryFn: async () => {
    const { data, error } = await db.from("roadmap_progress").select("step_id, status, completed_at");
    if (error) throw error;
    return (data ?? []) as ProgressRow[];
  },
});

export const roadmapPrefsQuery = queryOptions({
  queryKey: ["roadmap_prefs"],
  queryFn: async () => {
    const { data, error } = await db.from("roadmap_preferences").select("weekly_hours, pace, skill_level, target_date, priority_skills").maybeSingle();
    if (error) throw error;
    return (data as Prefs | null) ?? null;
  },
});

export const studyLogsQuery = queryOptions({
  queryKey: ["roadmap_study_logs"],
  queryFn: async () => {
    const { data, error } = await db.from("roadmap_study_logs").select("step_id, minutes, logged_on");
    if (error) throw error;
    return (data ?? []) as StudyLog[];
  },
});

export async function setItemStatus(stepId: string, status: ItemStatus) {
  const user_id = await getUserId();
  if (status === "not_started") {
    const { error } = await db.from("roadmap_progress").delete().eq("step_id", stepId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("roadmap_progress").upsert(
    { user_id, step_id: stepId, status, completed_at: status === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,step_id" },
  );
  if (error) throw error;
}

export async function logStudyTime(stepId: string, minutes: number) {
  const user_id = await getUserId();
  const { error } = await db.from("roadmap_study_logs").insert({ user_id, step_id: stepId, minutes });
  if (error) throw error;
}

export async function savePrefs(p: Prefs) {
  const user_id = await getUserId();
  const { error } = await db.from("roadmap_preferences").upsert({ user_id, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function setTargetRole(role: string) {
  const id = await getUserId();
  const { error } = await db.from("profiles").update({ target_role: role }).eq("id", id);
  if (error) throw error;
}

// ---------- Personalisation ----------

export type GapState = "missing" | "partial" | "strong" | null;
export type PlannedActivity = Activity & { gap: GapState; priority: boolean; optional: boolean; status: ItemStatus; completedAt: string | null; locked: boolean; blockers: string[]; minutes: number };
export type PlannedPhase = { id: string; index: number; title: string; description: string; items: PlannedActivity[] };

export function buildPlan(rm: RoleRoadmap, progress: ProgressRow[], prefs: Prefs, logs: StudyLog[], gapOf: (skill?: string) => GapState = () => null): PlannedPhase[] {
  const byId = new Map(progress.map((p) => [p.step_id, p]));
  const minutesBy = new Map<string, number>();
  for (const l of logs) minutesBy.set(l.step_id, (minutesBy.get(l.step_id) ?? 0) + l.minutes);
  const priority = new Set(prefs.priority_skills.map((s) => s.toLowerCase()));
  const statusOf = (id: string): ItemStatus => byId.get(id)?.status ?? "not_started";
  const doneLike = (id: string) => ["completed", "skipped"].includes(statusOf(id));

  return rm.phases.map((ph, index) => {
    const raw = ph.activities.map((id) => ACTIVITIES[id]!).filter(Boolean);
    const score = (a: Activity) => {
      const g = gapOf(a.skill);
      return (a.skill && priority.has(a.skill.toLowerCase()) ? 0 : 3) + (g === "missing" ? 0 : g === "partial" ? 1 : 2);
    };
    // Gap-first ordering that never places an item before its in-phase prerequisites.
    const remaining = [...raw].sort((a, b) => score(a) - score(b));
    const ordered: Activity[] = [];
    while (remaining.length) {
      const i = remaining.findIndex((a) => (a.prereqs ?? []).every((p) => !ph.activities.includes(p) || ordered.some((o) => o.id === p)));
      ordered.push(remaining.splice(i < 0 ? 0 : i, 1)[0]!);
    }
    const items = ordered.map<PlannedActivity>((a) => {
      const gap = gapOf(a.skill);
      const blockers = (a.prereqs ?? []).filter((p) => !doneLike(p)).map((p) => ACTIVITIES[p]?.title ?? p);
      return {
        ...a, gap,
        priority: !!a.skill && priority.has(a.skill.toLowerCase()),
        optional: gap === "strong" || (prefs.skill_level !== "beginner" && a.difficulty === "Beginner"),
        status: statusOf(a.id), completedAt: byId.get(a.id)?.completed_at ?? null,
        locked: blockers.length > 0 && statusOf(a.id) === "not_started", blockers,
        minutes: minutesBy.get(a.id) ?? 0,
      };
    });
    return { id: ph.id, index: index + 1, title: ph.title, description: ph.description, items };
  });
}

export function weekStart(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}

/** Adds skills to the roadmap's priority list without duplicates; keeps all progress. */
export async function addPrioritySkills(skills: string[]) {
  const { data, error } = await db.from("roadmap_preferences").select("weekly_hours, pace, skill_level, target_date, priority_skills").maybeSingle();
  if (error) throw error;
  const cur = (data as Prefs | null) ?? DEFAULT_PREFS;
  const have = new Set(cur.priority_skills.map((s) => s.toLowerCase()));
  const added = skills.filter((s) => !have.has(s.toLowerCase()));
  if (added.length) await savePrefs({ ...cur, priority_skills: [...cur.priority_skills, ...added] });
  return added;
}
