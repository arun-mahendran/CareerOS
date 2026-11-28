import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, BookOpen, FileText, Mic, MapPin, Briefcase, Bookmark, BookmarkCheck, Target, Search, Map as MapIcon } from "lucide-react";
import bannerUrl from "@/assets/careeros-banner.png";
import { CompanyMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { progressQuery, profileQuery } from "@/lib/user-data";
import { useSavedJobs } from "@/lib/use-save-job";
import { jobCatalogQuery } from "@/lib/job-catalog";
import { findRoadmap } from "@/lib/roadmap/catalog";
import { ROLE_REQUIREMENTS, analyze, readiness, userSkillsQuery } from "@/lib/skills/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — CareerOS" }, { name: "description", content: "Your real career activity at a glance." }, { property: "og:title", content: "Home — CareerOS" }, { property: "og:description", content: "Your real career activity at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

const JOURNEY = [
  { to: "/skills", title: "Analyze your skills", sub: "Find what you're missing for your target role.", icon: BarChart3, bg: "bg-tint-blue", ink: "text-tint-blue-ink" },
  { to: "/jobs", title: "Explore companies", sub: "Roles from official career portals.", icon: BookOpen, bg: "bg-tint-green", ink: "text-tint-green-ink" },
  { to: "/roadmap", title: "Follow your roadmap", sub: "Ordered steps that close your gaps.", icon: FileText, bg: "bg-tint-violet", ink: "text-tint-violet-ink" },
  { to: "/applications", title: "Track applications", sub: "Every stage, from saved to offer.", icon: Mic, bg: "bg-tint-orange", ink: "text-tint-orange-ink" },
] as const;

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="h-5 w-1 rounded-full bg-primary" />{children}</h2>{right}</div>;
}

function Dashboard() {
  const { data: profile } = useQuery(profileQuery);
  const { data: done = [] } = useQuery(progressQuery);
  const skillsQ = useQuery(userSkillsQuery);
  const catalog = useQuery(jobCatalogQuery);
  const { save, remove, statusOf } = useSavedJobs();

  const rm = findRoadmap(profile?.target_role);
  const stepIds = new Set(rm?.phases.flatMap((p) => p.activities) ?? []);
  const completed = done.filter((id) => stepIds.has(id)).length;
  const roadmapPct = stepIds.size ? Math.round((completed / stepIds.size) * 100) : 0;
  const reqs = rm ? ROLE_REQUIREMENTS[rm.role] ?? [] : [];
  const analyzed = analyze(reqs, skillsQ.data ?? [], rm?.role, "role");
  const assessed = analyzed.some((s) => s.current !== undefined);
  const skillPct = readiness(analyzed) ?? 0;
  const readinessPct = assessed ? Math.round(skillPct * 0.6 + roadmapPct * 0.4) : roadmapPct;
  const first = (profile?.full_name || profile?.email?.split("@")[0] || "").split(" ")[0];
  const recent = (catalog.data?.jobs ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="relative isolate flex min-h-[300px] items-center overflow-hidden rounded-2xl shadow-soft md:h-[300px]">
        <img src={bannerUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center] animate-kenburns" />
        <div className="absolute inset-0 -z-10 bg-banner-overlay" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/25 via-transparent to-transparent md:hidden" />
        <div className="max-w-2xl px-5 py-8 text-ink-foreground sm:px-8 md:px-10 md:py-8">
          <span className="inline-flex rounded-full border border-ink-foreground/25 bg-ink-foreground/10 px-3 py-1 text-xs backdrop-blur animate-rise">{first ? `Welcome back, ${first}` : "Your career journey starts here"}</span>
          <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl animate-rise [animation-delay:100ms]">Find the right opportunities,<br /><span className="text-gradient">build the right skills.</span></h1>
          <p className="mt-3 max-w-lg text-sm opacity-85 animate-rise [animation-delay:200ms]">Roles from real company portals, a personal roadmap, and every application in one place.</p>
          <div className="mt-5 flex flex-wrap gap-2.5 animate-rise [animation-delay:300ms]">
            <Link to="/jobs" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-float"><Search className="size-4" /> Explore jobs</Link>
            <Link to="/roadmap" className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5"><MapIcon className="size-4" /> View my roadmap</Link>
          </div>
        </div>
      </section>

      <section className="animate-rise [animation-delay:150ms]">
        <SectionTitle right={<Link to="/jobs" className="group inline-flex items-center gap-1 text-sm font-medium text-primary">View all <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>}>Recently posted jobs</SectionTitle>
        {catalog.isPending ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
          : recent.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">No real openings are synced yet. Add an official company board in Admin → Job Sources, then run a sync.</div>
          : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((j, i) => {
              const st = statusOf(j.id);
              return (
                <div key={j.id} className="lift relative flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-soft animate-rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyMark name={j.company} />
                    <div className="min-w-0 flex-1">
                      <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="block min-w-0">
                        <p className="line-clamp-2 break-words text-sm font-semibold leading-5 hover:text-primary [overflow-wrap:anywhere]">{j.title}</p>
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{j.company}</p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{j.posted}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 pr-8 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{j.location}</span></span>
                    {j.employmentType && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{j.employmentType}</span>}
                    {j.level !== "Not specified" && !j.employmentType && <span className="flex items-center gap-1"><Briefcase className="size-3.5" />{j.level}</span>}
                    {j.match !== null && <span className="rounded-full bg-tint-green px-2 py-0.5 text-[11px] font-medium text-tint-green-ink">{j.match}% match</span>}
                  </div>
                  <button aria-label={st ? "Unsave" : "Save"} onClick={() => (st ? remove.mutate(j.id) : save.mutate({ jobId: j.id, job: j }))} className="absolute right-3 bottom-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {st ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                  </button>
                </div>
              );
            })}
          </div>}
      </section>

      <section>
        <SectionTitle>Continue your journey</SectionTitle>
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((c, i) => (
            <Link key={c.title} to={c.to} className={cn("group lift flex min-h-36 flex-col rounded-xl border border-transparent p-4 animate-rise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", c.bg)} style={{ animationDelay: `${300 + i * 80}ms` }}>
              <span className={cn("grid size-10 place-items-center rounded-lg bg-card shadow-soft transition-colors group-hover:bg-background", c.ink)}><c.icon className="size-[18px]" /></span>
              <p className="mt-4 text-sm font-semibold">{c.title}</p>
              <div className="mt-1 flex flex-1 items-end justify-between gap-3"><p className="text-xs leading-relaxed text-muted-foreground">{c.sub}</p><span className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-card transition-transform duration-200 group-hover:translate-x-1", c.ink)}><ArrowRight className="size-3.5" /></span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="animate-rise [animation-delay:450ms]">
        <SectionTitle>Your target role</SectionTitle>
        <div className="grid gap-5 rounded-xl border bg-card p-4 shadow-soft sm:p-5 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-blue text-tint-blue-ink"><Target className="size-5" /></span>
            <div className="min-w-0">
              <p className="break-words font-semibold leading-5">{profile?.target_role ?? "Choose a target role"}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {reqs.slice(0, 4).map((s) => <span key={s.skill} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{s.skill}</span>)}
                {reqs.length > 4 && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">+{reqs.length - 4} more</span>}
                {reqs.length === 0 && <span className="text-xs text-muted-foreground">Select a role to see relevant skills.</span>}
              </div>
            </div>
          </div>
          <div className="min-w-0 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Career readiness</p><p className="font-display text-xl font-bold tabular-nums">{readinessPct}%</p></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success animate-fillbar" style={{ width: `${readinessPct}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Skills progress</span><span className="font-medium tabular-nums">{assessed ? `${skillPct}%` : "Not assessed"}</span></div>
                {assessed && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${skillPct}%` }} /></div>}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Roadmap progress</span><span className="font-medium tabular-nums">{roadmapPct}%</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${roadmapPct}%` }} /></div>
              </div>
            </div>
            <div className="mt-3 flex justify-end"><Link to="/skills" className="text-xs font-medium text-primary hover:underline">See gaps →</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}
