import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Briefcase, Building2, Check, ExternalLink, Globe, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Company, Job } from "@/lib/data";
import { jobCatalogQuery, type JobCatalog } from "@/lib/job-catalog";
import { ALL, EMPTY_FILTERS, filterCompanies, filterOptions, hasActiveFilters, initials, jobsFor, type DirectoryFilters } from "@/lib/companies/directory";
import { USE_API, companyDirectory } from "@/services/backend";
import { cn } from "@/lib/utils";

const DESC = "Discover companies, explore open positions, and follow organizations you want to work for.";

export const Route = createFileRoute("/_authenticated/companies")({
  head: () => ({ meta: [{ title: "Explore companies — CareerOS" }, { name: "description", content: DESC }, { property: "og:title", content: "Explore companies — CareerOS" }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Companies,
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const companyCount = (n: number) => plural(n, "company", "companies");

function Companies() {
  const catalog = useQuery(jobCatalogQuery);
  const [f, setF] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const companies = catalog.data?.companies ?? [];
  const jobs = catalog.data?.jobs ?? [];
  const options = useMemo(() => filterOptions(companies), [companies]);
  const list = useMemo(() => filterCompanies(companies, jobs, f), [companies, jobs, f]);
  const set = (patch: Partial<DirectoryFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const open = companies.find((c) => c.id === openId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Company directory"
        title="Explore companies"
        sub={DESC}
        right={catalog.isSuccess && companies.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5" />{companyCount(companies.length)}
          </span>
        ) : undefined}
      />

      <div className="mb-6 -mt-4 space-y-3 rounded-2xl border bg-card p-3 shadow-soft sm:p-4">
        <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search by company, industry, job title or location" aria-label="Search companies" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {f.q && <button type="button" onClick={() => set({ q: "" })} aria-label="Clear search" className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Industry" value={f.industry} options={options.industries} onChange={(industry) => set({ industry })} />
          <FilterSelect label="Location" value={f.location} options={options.locations} onChange={(location) => set({ location })} />
          <Chip pressed={f.activeOnly} onClick={() => set({ activeOnly: !f.activeOnly })}>Hiring now</Chip>
          <Chip pressed={f.followedOnly} onClick={() => set({ followedOnly: !f.followedOnly })}>Following</Chip>
          {hasActiveFilters(f) && (
            <button type="button" onClick={() => setF(EMPTY_FILTERS)} className="ml-auto text-xs font-medium text-primary hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {catalog.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
      ) : catalog.isError ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm shadow-soft">Couldn't load companies. <button className="text-primary underline" onClick={() => catalog.refetch()}>Try again</button></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <Building2 className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">{companies.length ? "No companies match your filters" : "No companies yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {companies.length ? "Try a different search or clear the filters."
              : USE_API ? "Companies appear after an admin adds and verifies an official job board."
              : "Connect the CareerOS server (VITE_API_URL) to load companies from official job boards."}
          </p>
          {companies.length > 0 && <button type="button" onClick={() => setF(EMPTY_FILTERS)} className="mt-4 text-sm font-medium text-primary hover:underline">Clear filters</button>}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">Showing {list.length} of {companyCount(companies.length)}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((c) => <CompanyCard key={c.id} c={c} onViewJobs={() => setOpenId(c.id)} />)}
          </div>
        </>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {open && <CompanyJobs c={open} jobs={jobsFor(open, jobs)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
      <SelectTrigger aria-label={label} className={cn("h-9 w-auto min-w-[8.5rem] max-w-[14rem] gap-2 text-sm", value !== ALL && "border-primary/50 text-primary")}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label === "Industry" ? "industries" : "locations"}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
        pressed ? "border-primary/50 bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
      {pressed && <Check className="size-3.5" />}{children}
    </button>
  );
}

function Logo({ c, size = "md" }: { c: Company; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "size-12 rounded-xl text-base" : "size-11 rounded-xl text-sm";
  if (c.logo && !failed) return <img src={c.logo} alt={`${c.name} logo`} onError={() => setFailed(true)} className={cn(box, "shrink-0 border bg-background object-contain p-1")} />;
  return <span aria-hidden className={cn(box, "grid shrink-0 place-items-center border bg-accent font-display font-bold text-accent-foreground")}>{initials(c.name)}</span>;
}

function FollowButton({ c }: { c: Company }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => (c.followed ? companyDirectory.unfollow(c.id) : companyDirectory.follow(c.id)),
    onSuccess: () => {
      qc.setQueryData<JobCatalog>(jobCatalogQuery.queryKey, (cur) => cur && { ...cur, companies: cur.companies.map((x) => (x.id === c.id ? { ...x, followed: !c.followed } : x)) });
      toast.success(c.followed ? `Unfollowed ${c.name}` : `Following ${c.name}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update follow status."),
  });
  return (
    <button type="button" onClick={() => m.mutate()} disabled={m.isPending || !USE_API} aria-pressed={c.followed}
      aria-label={c.followed ? `Unfollow ${c.name}` : `Follow ${c.name}`}
      className={cn("group inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
        c.followed ? "border-primary/40 bg-accent text-accent-foreground hover:border-destructive/50 hover:text-destructive" : "bg-background hover:border-primary/50 hover:text-primary")}>
      {m.isPending ? "Saving…" : c.followed ? <><Check className="size-3.5" />Following</> : <><Plus className="size-3.5" />Follow</>}
    </button>
  );
}

function CompanyCard({ c, onViewJobs }: { c: Company; onViewJobs: () => void }) {
  const meta = [c.industry, c.hq].filter((v) => v && v !== "Not specified");
  const link = c.careers || c.website;
  return (
    <article className="lift flex h-full flex-col rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <Logo c={c} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold leading-tight">{c.name}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.industry !== "Not specified" ? c.industry : "Industry not listed"}</p>
        </div>
        <FollowButton c={c} />
      </div>
      <p className="mt-4 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{c.about || "No company description yet."}</p>
      <div className="mb-5 mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {meta.length > 1 && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.hq}</span>}
        <span className={cn("inline-flex items-center gap-1", c.activeJobs > 0 && "font-medium text-foreground")}>
          <Briefcase className="size-3.5" />{c.activeJobs > 0 ? plural(c.activeJobs, "open position") : "No open positions"}
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
        <button type="button" onClick={onViewJobs} disabled={c.activeJobs === 0}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
          View jobs
        </button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            {c.careers ? "Careers page" : "Website"}<ExternalLink className="size-3 shrink-0" />
          </a>
        )}
      </div>
    </article>
  );
}

function CompanyJobs({ c, jobs }: { c: Company; jobs: Job[] }) {
  return (
    <>
      <SheetHeader className="border-b p-5 pr-12 text-left">
        <div className="flex items-center gap-3">
          <Logo c={c} size="lg" />
          <div className="min-w-0">
            <SheetTitle className="truncate">{c.name}</SheetTitle>
            <SheetDescription>{plural(c.activeJobs, "open position")}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <FollowButton c={c} />
          {c.careers && <a href={c.careers} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:text-primary">Careers page <ExternalLink className="size-3" /></a>}
          {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Globe className="size-3" />Website</a>}
        </div>
      </SheetHeader>
      <ul className="flex-1 divide-y overflow-y-auto">
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
            <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium hover:text-primary">{j.title}</p>
              <p className="truncate text-xs text-muted-foreground">{[j.location, j.mode, j.posted].filter((v) => v && v !== "Not specified").join(" · ")}</p>
            </Link>
            {j.portal && <a href={j.portal} target="_blank" rel="noreferrer" aria-label={`Apply for ${j.title} on the official portal`} className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">Apply <ExternalLink className="inline size-3" /></a>}
          </li>
        ))}
        {jobs.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No listed roles right now.</li>}
      </ul>
    </>
  );
}
