// Resume document model, defaults, quality checks and job alignment.
// Pure functions only — shared by the editor, preview and exporters.
import type { Job } from "@/lib/data";

export type Bulleted = { id: string; bullets: string[] };
export type Experience = Bulleted & { title: string; company: string; type: string; start: string; end: string; current: boolean; location: string; achievements: string[] };
export type Project = Bulleted & { name: string; description: string; tech: string; repo: string; demo: string };
export type SkillGroup = { id: string; category: string; skills: string[] };
export type Education = { id: string; degree: string; institution: string; field: string; start: string; end: string; grade: string };
export type Certification = { id: string; name: string; issuer: string; date: string; url: string };
export type Achievement = { id: string; title: string; issuer: string; date: string; description: string };

export type SectionKey = "summary" | "experience" | "projects" | "skills" | "education" | "certifications" | "achievements";
export type TemplateId = "ats" | "modern" | "fresher" | "minimal";

export type ResumeData = {
  personal: { name: string; title: string; email: string; phone: string; location: string; linkedin: string; github: string; portfolio: string };
  summary: string;
  experience: Experience[];
  projects: Project[];
  skills: SkillGroup[];
  education: Education[];
  certifications: Certification[];
  achievements: Achievement[];
  order: SectionKey[];
  hidden: SectionKey[];
  /** Entry ids left out of this version (e.g. when tailoring to a job). */
  exclude?: string[];
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Professional summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Technical skills",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};

export const OPTIONAL_SECTIONS: SectionKey[] = ["certifications", "achievements"];

export const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: "ats", name: "ATS Professional", hint: "Single column, plain headings" },
  { id: "modern", name: "Modern Developer", hint: "Accent headings, compact" },
  { id: "fresher", name: "Fresher / Graduate", hint: "Education and projects first" },
  { id: "minimal", name: "Minimal Professional", hint: "Serif, lots of air" },
];

export const SKILL_CATEGORIES = ["Programming Languages", "Frameworks", "Databases", "Developer Tools", "Cloud and DevOps", "Other Technical Skills"];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyResume(p?: { name?: string | null; email?: string | null; role?: string | null }): ResumeData {
  return {
    personal: { name: p?.name ?? "", title: p?.role ?? "", email: p?.email ?? "", phone: "", location: "", linkedin: "", github: "", portfolio: "" },
    summary: "",
    experience: [],
    projects: [],
    skills: SKILL_CATEGORIES.slice(0, 3).map((c) => ({ id: uid(), category: c, skills: [] })),
    education: [],
    certifications: [],
    achievements: [],
    order: ["summary", "experience", "projects", "skills", "education", "certifications", "achievements"],
    hidden: ["certifications", "achievements"],
  };
}

/** Fill any fields missing from older saved records. */
export function normalize(d: Partial<ResumeData> | null | undefined, fallback: ResumeData): ResumeData {
  return { ...fallback, ...(d ?? {}), personal: { ...fallback.personal, ...(d?.personal ?? {}) } };
}

export const blank = {
  experience: (): Experience => ({ id: uid(), title: "", company: "", type: "Internship", start: "", end: "", current: false, location: "", bullets: [""], achievements: [] }),
  project: (): Project => ({ id: uid(), name: "", description: "", tech: "", repo: "", demo: "", bullets: [] }),
  education: (): Education => ({ id: uid(), degree: "", institution: "", field: "", start: "", end: "", grade: "" }),
  certification: (): Certification => ({ id: uid(), name: "", issuer: "", date: "", url: "" }),
  achievement: (): Achievement => ({ id: uid(), title: "", issuer: "", date: "", description: "" }),
};

export function fmtMonth(v: string) {
  if (!v) return "";
  const [y, m] = v.split("-");
  if (!m) return y ?? "";
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "numeric" });
}

export function dateRange(start: string, end: string, current = false) {
  const s = fmtMonth(start);
  const e = current ? "Present" : fmtMonth(end);
  return [s, e].filter(Boolean).join(" – ");
}

export function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

const urlOk = (u: string) => !u || /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(u);
export const displayUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** Completion per section (0..1) used for section indicators and the step bar. */
export function sectionDone(d: ResumeData) {
  const p = d.personal;
  return {
    personal: p.name && p.email && p.title ? 1 : p.name || p.email ? 0.5 : 0,
    summary: d.summary.trim().length >= 80 ? 1 : d.summary ? 0.5 : 0,
    experience: d.experience.some((e) => e.title && e.company) ? 1 : 0,
    projects: d.projects.some((x) => x.name && x.description) ? 1 : d.projects.length ? 0.5 : 0,
    skills: d.skills.reduce((a, g) => a + g.skills.length, 0) >= 5 ? 1 : d.skills.some((g) => g.skills.length) ? 0.5 : 0,
    education: d.education.some((e) => e.degree && e.institution) ? 1 : 0,
    certifications: d.certifications.some((c) => c.name) ? 1 : 0,
    achievements: d.achievements.some((a) => a.title) ? 1 : 0,
    links: [p.linkedin, p.github, p.portfolio].some(Boolean) ? 1 : 0,
  };
}

/** Formatting/completeness checks. Never claims ATS success. */
export function qualityChecks(d: ResumeData) {
  const tips: { ok: boolean; text: string }[] = [];
  const p = d.personal;
  tips.push({ ok: !!(p.name && p.email && p.phone), text: p.name && p.email && p.phone ? "Name, email and phone are present" : "Add your name, email and phone number" });
  tips.push({ ok: d.summary.trim().length >= 80, text: d.summary.trim().length >= 80 ? "Professional summary is present" : "Write a 2–3 line professional summary" });
  tips.push({ ok: d.education.some((e) => e.degree), text: d.education.some((e) => e.degree) ? "Education is included" : "Add your degree and institution" });
  const nSkills = d.skills.reduce((a, g) => a + g.skills.length, 0);
  tips.push({ ok: nSkills >= 5, text: nSkills >= 5 ? `${nSkills} skills listed` : "List at least 5 skills you actually use" });
  const thin = d.projects.find((x) => x.name && x.description.trim().length < 40);
  if (d.projects.length === 0) tips.push({ ok: false, text: "Add at least one project — they matter a lot for freshers" });
  else tips.push({ ok: !thin, text: thin ? `Add a fuller description to "${thin.name}"` : "Projects have descriptions" });
  const noTech = d.projects.find((x) => x.name && !x.tech);
  if (noTech) tips.push({ ok: false, text: `List the technologies used in "${noTech.name}", if you actually used them` });
  const bad = (["linkedin", "github", "portfolio"] as const).filter((k) => !urlOk(p[k]));
  tips.push({ ok: bad.length === 0, text: bad.length ? `Your ${bad.join(", ")} URL looks incomplete — start with https://` : "Links are correctly formatted" });
  const emptyBullets = d.experience.some((e) => e.bullets.filter((b) => b.trim()).length === 0 && e.title);
  if (emptyBullets) tips.push({ ok: false, text: "Describe what you did in each experience entry" });
  const score = Math.round((100 * tips.filter((t) => t.ok).length) / tips.length);
  return { tips, score };
}

export function resumeText(d: ResumeData) {
  return [
    d.personal.title, d.summary,
    ...d.experience.flatMap((e) => [e.title, ...e.bullets, ...e.achievements]),
    ...d.projects.flatMap((x) => [x.name, x.description, x.tech, ...x.bullets]),
    ...d.skills.flatMap((g) => g.skills),
  ].join(" ").toLowerCase();
}

/** Transparent keyword alignment against the job's listed skills — not a hiring probability. */
export function jobAlignment(d: ResumeData, job: Job) {
  const text = resumeText(d);
  const has = (s: string) => text.includes(s.toLowerCase());
  const present = job.skills.filter(has);
  const missing = job.skills.filter((s) => !has(s));
  const projects = d.projects.filter((x) => job.skills.some((s) => `${x.tech} ${x.description}`.toLowerCase().includes(s.toLowerCase())));
  const experience = d.experience.filter((e) => job.skills.some((s) => [e.title, ...e.bullets].join(" ").toLowerCase().includes(s.toLowerCase())));
  return { present, missing, projects, experience, pct: job.skills.length ? Math.round((100 * present.length) / job.skills.length) : 0 };
}
