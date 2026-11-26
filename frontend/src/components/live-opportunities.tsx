import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CompanyMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs, type JobFilters } from "@/services/backend";
import { useSavedJobs } from "@/lib/use-save-job";
import { toCatalogJob } from "@/lib/job-catalog";
import { cn } from "@/lib/utils";

const MODES = ["All", "Remote", "Hybrid", "On-site"] as const;
const TYPES = ["All types", "Full-time", "Part-time", "Contract", "Internship"] as const;
const PAGE_SIZE = 20;

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function ago(iso: string | null) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Opportunities from the CareerOS server (PostgreSQL), refreshed on open and every few minutes. */
export function LiveOpportunities() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("All");
  const [type, setType] = useState<(typeof TYPES)[number]>("All types");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q), dl = useDebounced(location), ds = useDebounced(skill);
  useEffect(() => setPage(1), [dq, dl, ds, mode, type]);
  const { save, remove, statusOf } = useSavedJobs();

  const filters: JobFilters = {
    q: dq || undefined, location: dl || undefined, skill: ds || undefined,
    mode: mode === "All" ? undefined : mode, employment_type: type === "All types" ? undefined : type,
    sort: "newest", page, page_size: PAGE_SIZE,
  };
  const res = useQuery({
    queryKey: ["opportunities", filters],
    queryFn: () => jobs.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const data = res.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const meta = data?.meta;

  return (
    <>
      <PageHeader eyebrow="Discover" title="Opportunities" sub="Live roles from official company job boards, newest first." />

      {meta && (
        <p className="mb-4 text-xs text-muted-foreground">
          {meta.configured_sources === 0
            ? "No company job boards are configured yet."
            : `${meta.healthy_sources} of ${meta.configured_sources} company boards monitored · ${meta.last_successful_sync ? `updated ${ago(meta.last_successful_sync)}` : "not synced yet"} · ${meta.new_jobs} new in the last ${meta.new_window_hours} h`}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-soft">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles, companies, descriptions" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="flex rounded-lg border bg-card p-1">
          {MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1.5 text-xs", mode === m ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground")}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" aria-label="Location" className="rounded-lg border bg-card px-3 py-2 text-sm shadow-soft outline-none" />
        <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill" aria-label="Skill" className="rounded-lg border bg-card px-3 py-2 text-sm shadow-soft outline-none" />
        <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} aria-label="Employment type" className="rounded-lg border bg-card px-3 py-2 text-sm shadow-soft outline-none">
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {res.isPending ? (
        <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : res.isError ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm shadow-soft">
          <p>We couldn't refresh opportunities right now.</p>
          <button onClick={() => res.refetch()} className="mt-3 inline-flex items-center gap-1.5 text-primary"><RefreshCw className="size-3.5" /> Try again</button>
        </div>
      ) : (
        <div className={cn("space-y-3", res.isFetching && "opacity-70")}>
          {data!.items.map((j) => {
            const st = statusOf(j.id);
            return (
              <div key={j.id} className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-soft transition hover:border-primary/30">
                <CompanyMark name={j.company} />
                <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {j.title}
                    {j.is_new && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">New</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[j.company, j.location, j.work_mode !== "Not specified" ? j.work_mode : null, j.employment_type, j.salary].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {j.posted_at_known ? `Posted ${new Date(j.posted_at).toLocaleDateString()}` : `Found ${new Date(j.first_seen_at ?? j.posted_at).toLocaleDateString()}`} · via {j.source.name}
                  </p>
                </Link>
                <a href={j.apply_url} target="_blank" rel="noreferrer" aria-label={`Apply to ${j.title} on the official portal`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <ExternalLink className="size-4" />
                </a>
                <button
                  aria-label={st ? "Unsave" : "Save"}
                  onClick={() => (st ? remove.mutate(j.id) : save.mutate({ jobId: j.id, job: toCatalogJob(j) }))}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {st ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                </button>
              </div>
            );
          })}
          {data!.items.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {meta?.configured_sources === 0
                ? "No live roles yet. An admin needs to add a company job board (Greenhouse, Lever or Ashby) in Job Sources."
                : "No roles match these filters yet."}
            </p>
          )}
          {data!.total > data!.page_size && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>{data!.total} roles · page {page} of {pages}</span>
              <div className="flex gap-2">
                <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border bg-card p-1.5 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                <button aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border bg-card p-1.5 disabled:opacity-40"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
