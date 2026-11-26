import type { Company, Job } from "@/lib/data";

export const ALL = "all";
export type DirectoryFilters = { q: string; industry: string; location: string; activeOnly: boolean; followedOnly: boolean };
export const EMPTY_FILTERS: DirectoryFilters = { q: "", industry: ALL, location: ALL, activeOnly: false, followedOnly: false };

const known = (v: string) => !!v && v !== "Not specified";

/** Jobs that belong to a company: by server id when available, otherwise by exact company name. */
export function jobsFor(company: Company, jobs: Job[]): Job[] {
  return jobs.filter((j) => (j.companyId ? j.companyId === company.id : j.company === company.name));
}

/** Distinct, real filter values (unknown values excluded), sorted alphabetically. */
export function filterOptions(companies: Company[]) {
  const uniq = (xs: string[]) => [...new Set(xs.filter(known))].sort((a, b) => a.localeCompare(b));
  return { industries: uniq(companies.map((c) => c.industry)), locations: uniq(companies.map((c) => c.hq)) };
}

export function hasActiveFilters(f: DirectoryFilters) {
  return f.q.trim() !== "" || f.industry !== ALL || f.location !== ALL || f.activeOnly || f.followedOnly;
}

/** Search matches company name, industry, headquarters, and titles/locations of the company's listed jobs. */
export function filterCompanies(companies: Company[], jobs: Job[], f: DirectoryFilters): Company[] {
  const q = f.q.trim().toLowerCase();
  return companies.filter((c) => {
    if (f.industry !== ALL && c.industry !== f.industry) return false;
    if (f.location !== ALL && c.hq !== f.location) return false;
    if (f.activeOnly && c.activeJobs <= 0) return false;
    if (f.followedOnly && !c.followed) return false;
    if (!q) return true;
    const fields = [c.name, c.industry, c.hq, ...jobsFor(c, jobs).flatMap((j) => [j.title, j.location])];
    return fields.some((v) => known(v) && v.toLowerCase().includes(q));
  });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
