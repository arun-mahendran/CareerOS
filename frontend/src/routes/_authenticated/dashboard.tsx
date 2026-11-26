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
    <div className="space-y-10">
      <section className="relative isolate overflow-hidden rounded-2xl shadow-float">
        <img src={bannerUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center] animate-kenburns" />
        <div className="absolute inset-0 -z-10 bg-banner-overlay" />
        <div className="max-w-xl px-6 py-7 text-ink-foreground md:px-10 md:py-10">
          <span className="inline-flex rounded-full border border-ink-foreground/25 bg-ink-foreground/10 px-3 py-1 text-xs backdrop-blur animate-rise">{first ? `Welcome back, ${first}` : "Your career journey starts here"}</span>
          <h1 className="mt-5 text-3xl font-bold leading-tight md:text-4xl animate-rise [animation-delay:100ms]">Find the right opportunities,<br /><span className="text-gradient">build the right skills.</span></h1>
          <p className="mt-4 text-sm opacity-80 animate-rise [animation-delay:200ms]">Roles from real company portals, a personal roadmap, and every application in one place.</p>
          <div className="mt-7 flex flex-wrap gap-3 animate-rise [animation-delay:300ms]">
            <Link to="/jobs" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-float"><Search className="size-4" /> Explore jobs</Link>
            <Link to="/roadmap" className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5"><MapIcon className="size-4" /> View my roadmap</Link>
          </div>
        </div>
      </section>

      <section className="animate-rise [animation-delay:150ms]">
        <SectionTitle right={<Link to="/jobs" className="group inline-flex items-center gap-1 text-sm font-medium text-primary">View all <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>}>Recently posted jobs</SectionTitle>
        {catalog.isPending ? <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
          : recent.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">No real openings are synced yet. Add an official company board in Admin → Job Sources, then run a sync.</div>
          : <div className="grid gap-4 md:grid-cols-3">
            {recent.map((j, i) => {
              const st = statusOf(j.id);
              return (
                <div key={j.id} className="lift relative rounded-xl border bg-card p-5 shadow-soft animate-rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
                  <div className="flex items-start gap-3">
                    <CompanyMark name={j.company} />
                    <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{j.title}</p><p className="text-xs text-muted-foreground">{j.company}</p></Link>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{j.posted}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3.5" />{j.location}</span>
                    <span className="flex items-center gap-1"><Briefcase className="size-3.5" />{j.level}</span>
                  </div>
                  <button aria-label={st ? "Unsave" : "Save"} onClick={() => (st ? remove.mutate(j.id) : save.mutate({ jobId: j.id, job: j }))} className="absolute right-4 bottom-4 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                    {st ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                  </button>
                </div>
              );
            })}
          </div>}
      </section>

      <section>
        <SectionTitle>Continue your journey</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((c, i) => (
            <Link key={c.title} to={c.to} className={cn("group lift flex flex-col rounded-xl p-5 animate-rise", c.bg)} style={{ animationDelay: `${300 + i * 80}ms` }}>
              <span className={cn("grid size-11 place-items-center rounded-xl bg-card shadow-soft transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", c.ink)}><c.icon className="size-5" /></span>
              <p className="mt-5 text-sm font-semibold">{c.title}</p>
              <div className="mt-1 flex items-end justify-between gap-3"><p className="text-xs text-muted-foreground">{c.sub}</p><span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-card transition-transform duration-300 group-hover:translate-x-1", c.ink)}><ArrowRight className="size-3.5" /></span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="animate-rise [animation-delay:450ms]">
        <SectionTitle>Your target role</SectionTitle>
        <div className="grid gap-6 rounded-xl border bg-card p-6 shadow-soft md:grid-cols-2 md:divide-x">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-xl bg-tint-blue text-tint-blue-ink"><Target className="size-7" /></span>
            <div>
              <p className="font-semibold">{profile?.target_role ?? "Choose a target role"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reqs.slice(0, 4).map((s) => <span key={s.skill} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{s.skill}</span>)}
                {reqs.length > 4 && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">+{reqs.length - 4} more</span>}
              </div>
            </div>
          </div>
          <div className="md:pl-6">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Career readiness</p><p className="font-display text-2xl font-bold">{readinessPct}%</p></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success animate-fillbar" style={{ width: `${readinessPct}%` }} /></div>
            <div className="mt-3 flex items-center justify-between"><p className="text-xs text-muted-foreground">Skills on target {assessed ? `${skillPct}%` : "not assessed"} · Roadmap {roadmapPct}%</p><Link to="/skills" className="text-xs font-medium text-primary">See gaps →</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}
