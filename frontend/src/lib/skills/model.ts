import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import { getUserId } from "@/lib/user-data";
import { ACTIVITIES, findRoadmap, type Activity, type ActivityResource } from "@/lib/roadmap/catalog";
import type { Job } from "@/lib/data";

// Proficiency scale used everywhere (self-assessment and requirements).
export const LEVELS = ["Unfamiliar", "Beginner", "Intermediate", "Advanced", "Expert"] as const;
export type Importance = "Required" | "Preferred";
export type Requirement = { skill: string; level: number; importance: Importance };
export type UserSkill = { skill: string; level: number; source: "self" | "assessment" | "project"; updated_at: string };
export type Status = "on_target" | "improve" | "missing" | "not_assessed";

export const STATUS_LABEL: Record<Status, string> = {
  on_target: "On target", improve: "Needs improvement", missing: "Missing / not demonstrated", not_assessed: "Not assessed",
};
export const SOURCE_LABEL = { self: "Self-reported", assessment: "Assessment-based", project: "Project-based" } as const;

const req = (skill: string, level: number, importance: Importance = "Required"): Requirement => ({ skill, level, importance });

/** Role profiles: the skills each target role is configured to require. */
export const ROLE_REQUIREMENTS: Record<string, Requirement[]> = {
  "Frontend Engineer": [req("JavaScript", 3), req("TypeScript", 3), req("React", 3), req("REST APIs", 2), req("Accessibility", 2), req("Testing", 2), req("Git", 2), req("System Design", 2, "Preferred"), req("CI/CD", 1, "Preferred")],
  "Java Full Stack Developer": [req("Java", 3), req("Spring Boot", 3), req("SQL", 3), req("Data Structures", 2), req("Algorithms", 2), req("JavaScript", 2), req("React", 2), req("REST APIs", 3), req("Git", 2), req("Docker", 2), req("CI/CD", 1, "Preferred"), req("AWS", 1, "Preferred")],
  "Backend Developer": [req("JavaScript", 3), req("Node.js", 3), req("SQL", 3), req("REST APIs", 3), req("Data Structures", 2), req("Git", 2), req("Docker", 2), req("System Design", 2), req("CI/CD", 1, "Preferred"), req("AWS", 1, "Preferred")],
  "Python Developer": [req("Python", 3), req("REST APIs", 3), req("SQL", 2), req("Data Structures", 2), req("Algorithms", 2), req("Testing", 2), req("Git", 2), req("Docker", 2, "Preferred"), req("CI/CD", 1, "Preferred")],
  "Data Analyst": [req("SQL", 3), req("Python", 2), req("Statistics", 3), req("Dashboards", 3), req("Git", 1, "Preferred")],
  "Data Engineer": [req("Python", 3), req("SQL", 3), req("Spark", 2), req("Airflow", 2), req("Git", 2), req("Docker", 2), req("AWS", 2, "Preferred"), req("CI/CD", 1, "Preferred")],
};

export const CATEGORY_ORDER = ["Core Technical Skills", "Frameworks and Libraries", "Databases", "Developer Tools", "Cloud and DevOps", "DSA and CS Fundamentals", "Supporting Skills"] as const;
const CATEGORY: Record<string, (typeof CATEGORY_ORDER)[number]> = {
  JavaScript: "Core Technical Skills", TypeScript: "Core Technical Skills", Java: "Core Technical Skills", Python: "Core Technical Skills", CSS: "Core Technical Skills", "REST APIs": "Core Technical Skills",
  React: "Frameworks and Libraries", "Spring Boot": "Frameworks and Libraries", "Node.js": "Frameworks and Libraries", "Next.js": "Frameworks and Libraries", Spark: "Frameworks and Libraries", WebGL: "Frameworks and Libraries",
  SQL: "Databases",
  Git: "Developer Tools", Testing: "Developer Tools", Airflow: "Developer Tools",
  Docker: "Cloud and DevOps", "CI/CD": "Cloud and DevOps", AWS: "Cloud and DevOps",
  "Data Structures": "DSA and CS Fundamentals", Algorithms: "DSA and CS Fundamentals", "System Design": "DSA and CS Fundamentals",
};
export const categoryOf = (s: string) => CATEGORY[s] ?? "Supporting Skills";

export function requirementsFor(role: string | null | undefined, job?: Job | null): { mode: "role" | "job"; reqs: Requirement[]; source: string } {
  if (job) {
    // Listings name required skills but not levels, so Intermediate is assumed and labelled as such.
    return { mode: "job", reqs: job.skills.map((s) => req(s, 2)), source: `${job.title} at ${job.company} listing` };
  }
  const rm = findRoadmap(role);
  return { mode: "role", reqs: rm ? ROLE_REQUIREMENTS[rm.role] ?? [] : [], source: rm ? `CareerOS ${rm.role} role profile` : "" };
}

export const userSkillsQuery = queryOptions({
  queryKey: ["user_skills"],
  queryFn: async () => {
    const { data, error } = await db.from("user_skills").select("skill, level, source, updated_at");
    if (error) throw error;
    return (data ?? []) as UserSkill[];
  },
});

export async function saveSkillLevels(rows: { skill: string; level: number }[]) {
  const user_id = await getUserId();
  const now = new Date().toISOString();
  const { error } = await db.from("user_skills").upsert(rows.map((r) => ({ user_id, skill: r.skill, level: r.level, source: "self", updated_at: now })), { onConflict: "user_id,skill" });
  if (error) throw error;
}

export function statusOf(level: number | undefined, required: number): Status {
  if (level === undefined) return "not_assessed";
  if (level === 0) return "missing";
  return level >= required ? "on_target" : "improve";
}

/** Shared gap lookup for the roadmap: maps a skill to missing/partial/strong from saved levels. */
export function gapFromLevels(levels: Map<string, number>, reqs: Requirement[], skill?: string): "missing" | "partial" | "strong" | null {
  if (!skill) return null;
  const r = reqs.find((x) => x.skill.toLowerCase() === skill.toLowerCase());
  const lv = levels.get(skill.toLowerCase());
  if (!r || lv === undefined) return null;
  const s = statusOf(lv, r.level);
  return s === "on_target" ? "strong" : s === "missing" || r.level - lv >= 2 ? "missing" : "partial";
}

export function activitiesForSkill(skill: string, role: string | null | undefined): Activity[] {
  const rm = findRoadmap(role);
  const inRole = new Set(rm?.phases.flatMap((p) => p.activities) ?? []);
  const all = Object.values(ACTIVITIES).filter((a) => a.skill?.toLowerCase() === skill.toLowerCase());
  return all.sort((a, b) => Number(inRole.has(b.id)) - Number(inRole.has(a.id)));
}

export type Analyzed = Requirement & {
  category: string; current?: number | undefined; source?: UserSkill["source"] | undefined; updatedAt?: string | undefined; status: Status; gap: number;
  hours: number | null; activities: Activity[]; prereqSkills: string[]; unlocks: number; priority: number; reason: string; action: string;
  resources: ActivityResource[];
};

export function analyze(reqs: Requirement[], skills: UserSkill[], role: string | null | undefined, mode: "role" | "job"): Analyzed[] {
  const bySkill = new Map(skills.map((s) => [s.skill.toLowerCase(), s]));
  const base = reqs.map((r) => {
    const us = bySkill.get(r.skill.toLowerCase());
    const status = statusOf(us?.level, r.level);
    const acts = activitiesForSkill(r.skill, role);
    const prereqSkills = Array.from(new Set(acts.flatMap((a) => a.prereqs ?? []).map((id) => ACTIVITIES[id]?.skill).filter((s): s is string => !!s && s.toLowerCase() !== r.skill.toLowerCase())));
    return { ...r, us, status, acts, prereqSkills, gap: us ? Math.max(0, r.level - us.level) : r.level };
  });
  const gapSkills = new Set(base.filter((b) => b.status === "missing" || b.status === "improve").map((b) => b.skill));
  return base.map((b) => {
    const unlocks = base.filter((o) => gapSkills.has(o.skill) && o.prereqSkills.includes(b.skill)).length;
    const weight = b.importance === "Required" ? 2 : 1;
    const open = b.status === "missing" || b.status === "improve";
    const priority = open ? weight * 10 + b.gap * 5 + unlocks * 4 : 0;
    const why = mode === "job" ? "Listed as a requirement in the selected job." : `${b.importance} for this role at ${LEVELS[b.level]} level.`;
    const reason = unlocks ? `${why} It's also a prerequisite for ${unlocks} other gap${unlocks > 1 ? "s" : ""}.` : why;
    const first = b.acts[0];
    const action = b.status === "on_target" ? "Keep it sharp and back it with evidence on your resume."
      : b.status === "not_assessed" ? "Rate your level so CareerOS can tell whether this is a gap."
      : first ? `${first.title}: ${first.summary}` : `Build a small project that uses ${b.skill}.`;
    return {
      skill: b.skill, level: b.level, importance: b.importance, category: categoryOf(b.skill),
      current: b.us?.level, source: b.us?.source, updatedAt: b.us?.updated_at, status: b.status, gap: b.gap,
      hours: b.acts.length ? b.acts.reduce((s, a) => s + a.hours, 0) : null, activities: b.acts, prereqSkills: b.prereqSkills,
      unlocks, priority, reason, action,
      resources: Array.from(new Map(b.acts.flatMap((a) => a.resources).map((r) => [r.url, r])).values()),
    };
  });
}

/** Weighted alignment: Required skills count double; each skill contributes min(level/target, 1). */
export function readiness(items: Analyzed[]) {
  const assessed = items.filter((i) => i.current !== undefined);
  if (!assessed.length) return null;
  const w = (i: Analyzed) => (i.importance === "Required" ? 2 : 1);
  const total = items.reduce((s, i) => s + w(i), 0);
  const got = assessed.reduce((s, i) => s + w(i) * Math.min(1, (i.current ?? 0) / i.level), 0);
  return Math.round((100 * got) / total);
}
