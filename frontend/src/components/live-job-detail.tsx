import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CompanyMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs } from "@/services/backend";
import { useSavedJobs } from "@/lib/use-save-job";
import { toCatalogJob } from "@/lib/job-catalog";

/** Role details exactly as published by the company's job board; missing fields are simply not shown. */
export function LiveJobDetail({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["opportunity", id], queryFn: () => jobs.get(id) });
  const { save, statusOf } = useSavedJobs();

  if (q.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (q.isError || !q.data)
    return <p className="text-sm text-muted-foreground">This role is no longer available. <Link to="/jobs" className="text-primary">Browse roles</Link></p>;
  const job = q.data;
  const status = statusOf(job.id);
  const facts = [job.location, job.work_mode !== "Not specified" ? job.work_mode : null, job.employment_type, job.department, job.salary].filter(Boolean);

  return (
    <div className="animate-rise">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Opportunities</Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <CompanyMark name={job.company} />
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{[job.company, ...facts].join(" · ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Source: {job.source.name} · {job.posted_at_known ? `posted ${new Date(job.posted_at).toLocaleDateString()}` : `found ${new Date(job.first_seen_at ?? job.posted_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save.mutate({ jobId: job.id, job: toCatalogJob(job) })} disabled={!!status} className="rounded-lg border bg-card px-4 py-2 text-sm font-medium disabled:opacity-60">
            {status ? `In pipeline · ${status}` : "Save"}
          </button>
          <a href={job.apply_url} target="_blank" rel="noreferrer" onClick={() => save.mutate({ jobId: job.id, status: "applied", job: toCatalogJob(job) })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Apply on official portal <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border bg-card p-6 shadow-soft">
        <p className="eyebrow">About the role</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{job.description || "The company hasn't published a description for this role. See the official posting."}</p>
        {job.skills.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">{job.skills.map((s) => <span key={s.name} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{s.name}</span>)}</div>
        )}
        <a href={job.official_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm text-primary">View official posting <ExternalLink className="size-3" /></a>
      </section>
    </div>
  );
}
