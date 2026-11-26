import { queryOptions } from "@tanstack/react-query";
import type { Company, Job } from "@/lib/data";
import { USE_API, companyDirectory, jobs, type LiveJob } from "@/services/backend";

export type JobCatalog = { jobs: Job[]; companies: Company[] };

/** Convert an employer-published listing without inventing match scores or missing details. */
export function toCatalogJob(j: LiveJob): Job {
  const mode = j.work_mode === "Remote" || j.work_mode === "Hybrid" || j.work_mode === "On-site" ? j.work_mode : "Not specified";
  const intern = j.employment_type?.toLowerCase() === "internship" || j.level.toLowerCase().includes("intern");
  const associate = j.level.toLowerCase().includes("associate");
  const seen = j.first_seen_at ?? j.posted_at;
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location || "Not specified",
    mode,
    level: intern ? "Intern" : associate ? "Associate" : j.level.toLowerCase().includes("entry") ? "Entry" : "Not specified",
    salary: j.salary ?? "Not specified",
    posted: new Date(j.posted_at_known ? j.posted_at : seen).toLocaleDateString(),
    match: null,
    skills: j.skills.map((s) => s.name),
    missing: [],
    about: j.description,
    responsibilities: j.requirements,
    portal: j.apply_url,
    companyId: j.company_id,
  };
}

async function allLiveJobs() {
  const first = await jobs.list({ page: 1, page_size: 100, sort: "newest" });
  const pages = Math.ceil(first.total / first.page_size);
  if (pages <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => jobs.list({ page: i + 2, page_size: 100, sort: "newest" })));
  return [first, ...rest].flatMap((p) => p.items);
}

export const jobCatalogQuery = queryOptions({
  queryKey: ["job-catalog"],
  queryFn: async (): Promise<JobCatalog> => {
    if (!USE_API) return { jobs: [], companies: [] };
    const [liveJobs, companies] = await Promise.all([allLiveJobs(), companyDirectory.list()]);
    return {
      jobs: liveJobs.map(toCatalogJob),
      companies: companies.map((c) => ({
        id: c.id, slug: c.slug, name: c.name, industry: c.industry ?? "Not specified", hq: c.headquarters ?? "Not specified",
        website: c.website_url ?? "", careers: c.careers_url ?? "", logo: c.logo_url ?? "", about: c.description ?? "", activeJobs: c.active_jobs, followed: c.followed,
      })),
    };
  },
  staleTime: 60_000,
});
