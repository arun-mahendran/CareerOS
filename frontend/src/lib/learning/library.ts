import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import { getUserId } from "@/lib/user-data";
import { RESOURCES } from "@/lib/data";
import { ACTIVITIES, type Activity, type Difficulty } from "@/lib/roadmap/catalog";
import { categoryOf } from "@/lib/skills/model";

export type ResourceType = "Official Documentation" | "Tutorial" | "Video" | "Interactive Practice" | "Coding Challenge" | "Guide";
export type LibResource = {
  url: string; title: string; provider: string; description: string; skills: string[]; difficulty: Difficulty | null;
  type: ResourceType; minutes: number | null; category: string; activities: Activity[];
};

// Providers that publish the official docs for the technology they cover.
const OFFICIAL = /(developer\.mozilla|typescriptlang|react\.dev|docs\.docker|docs\.github|git-scm|postgresql\.org|spring\.io|docs\.oracle|dev\.java|python\.org|fastapi|pandas\.pydata|spark\.apache|airflow\.apache|docs\.getdbt|nodejs\.org|testing-library|vitest|pytest|aws\.amazon|tanstack|learn\.microsoft)/;

function typeFor(kind: string, url: string, provider: string): ResourceType {
  if (/leetcode|neetcode/i.test(url)) return "Coding Challenge";
  if (kind === "Practice") return "Interactive Practice";
  if (kind === "Watch") return "Video";
  if (OFFICIAL.test(url)) return "Official Documentation";
  return /playbook|primer/i.test(url + provider) ? "Guide" : "Tutorial";
}

/** Library tab for a resource, derived from its skill and activity. */
function tabFor(skill: string | undefined, acts: Activity[]): string {
  if (acts.some((a) => a.id.includes("interview"))) return "Interview Preparation";
  if (!skill) return "Projects";
  if (skill === "Testing") return "Testing";
  if (skill === "System Design") return "System Design";
  if (["Statistics", "Dashboards", "Spark", "Airflow"].includes(skill)) return "Data";
  const c = categoryOf(skill);
  return ({ "Core Technical Skills": "Programming", "Frameworks and Libraries": "Frameworks", Databases: "Databases", "Developer Tools": "Developer Tools", "Cloud and DevOps": "Cloud & DevOps", "DSA and CS Fundamentals": "DSA" } as Record<string, string>)[c] ?? "Programming";
}

const DIFF_RANK: Record<Difficulty, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

function build(): LibResource[] {
  const map = new Map<string, { kind: string; title: string; provider: string; acts: Activity[] }>();
  for (const a of Object.values(ACTIVITIES)) {
    for (const r of a.resources) {
      const e = map.get(r.url) ?? { kind: r.kind, title: r.title, provider: r.provider, acts: [] };
      if (!e.acts.includes(a)) e.acts.push(a);
      map.set(r.url, e);
    }
  }
  const out: LibResource[] = [...map.entries()].map(([url, e]) => {
    const skills = Array.from(new Set(e.acts.map((a) => a.skill).filter((s): s is string => !!s)));
    const legacy = RESOURCES.find((r) => r.url === url);
    const diffs = e.acts.map((a) => a.difficulty);
    const first = e.acts[0]!;
    return {
      url, title: e.title, provider: e.provider,
      description: e.acts.length === 1 ? first.summary : `Supports ${e.acts.map((a) => a.title).slice(0, 3).join(", ")}.`,
      skills, difficulty: legacy?.difficulty ?? (diffs.length ? diffs.sort((x, y) => DIFF_RANK[x] - DIFF_RANK[y])[0]! : null),
      type: typeFor(e.kind, url, e.provider), minutes: legacy?.minutes ?? null,
      category: tabFor(skills[0], e.acts), activities: e.acts,
    };
  });
  // Older catalog entries not tied to an activity.
  for (const r of RESOURCES) {
    if (!map.has(r.url)) out.push({ url: r.url, title: r.title, provider: r.provider, description: `${r.skill} resource from ${r.provider}.`, skills: [r.skill], difficulty: r.difficulty, type: typeFor("Read", r.url, r.provider), minutes: r.minutes, category: tabFor(r.skill, []), activities: [] });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export const LIBRARY = build();
export const LIBRARY_TABS = ["Programming", "Frameworks", "Databases", "DSA", "Testing", "Developer Tools", "Cloud & DevOps", "System Design", "Data", "Interview Preparation"].filter((t) => LIBRARY.some((r) => r.category === t));

export type ResourceProgress = { resource_url: string; saved: boolean; status: "not_started" | "in_progress" | "completed"; completed_at: string | null };

export const resourceProgressQuery = queryOptions({
  queryKey: ["learning_resource_progress"],
  queryFn: async () => {
    const { data, error } = await db.from("learning_resource_progress").select("resource_url, saved, status, completed_at");
    if (error) throw error;
    return (data ?? []) as ResourceProgress[];
  },
});

export async function updateResource(url: string, patch: Partial<Pick<ResourceProgress, "saved" | "status">>, current?: ResourceProgress) {
  const user_id = await getUserId();
  const next = { saved: current?.saved ?? false, status: current?.status ?? "not_started", ...patch };
  const { error } = await db.from("learning_resource_progress").upsert({
    user_id, resource_url: url, saved: next.saved, status: next.status,
    completed_at: next.status === "completed" ? (current?.completed_at ?? new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,resource_url" });
  if (error) throw error;
}
