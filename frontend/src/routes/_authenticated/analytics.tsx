import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { progressQuery, profileQuery } from "@/lib/user-data";
import { applicationsQuery } from "@/lib/applications";
import { applicationStageCounts } from "@/lib/application-analytics";
import { findRoadmap } from "@/lib/roadmap/catalog";
import { ROLE_REQUIREMENTS, analyze, userSkillsQuery } from "@/lib/skills/model";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Career analytics — CareerOS" }, { name: "description", content: "Your real activity: saved jobs, applications, roadmap and skills." }, { property: "og:title", content: "Career analytics — CareerOS" }, { property: "og:description", content: "Your real activity: saved jobs, applications, roadmap and skills." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Analytics,
});

function Analytics() {
  const applications = useQuery(applicationsQuery);
  const profile = useQuery(profileQuery);
  const skills = useQuery(userSkillsQuery);
  const saved = applications.data ?? [];
  const { data: done = [] } = useQuery(progressQuery);
  const rm = findRoadmap(profile.data?.target_role);
  const stepIds = new Set(rm?.phases.flatMap((p) => p.activities) ?? []);
  const completed = done.filter((id) => stepIds.has(id)).length;
  const roadmap = stepIds.size ? Math.round((100 * completed) / stepIds.size) : 0;
  const reqs = rm ? ROLE_REQUIREMENTS[rm.role] ?? [] : [];
  const analyzed = analyze(reqs, skills.data ?? [], rm?.role, "role");
  const onTarget = analyzed.filter((s) => s.status === "on_target").length;
  const counts = applicationStageCounts(saved);

  return (
    <>
      <PageHeader eyebrow="Career analytics" title="Your progress" sub="Activity you control. No hiring predictions — just where your effort is going." />
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Jobs tracked", saved.length], ["Applied or later", saved.filter((j) => j.status !== "saved").length], ["Roadmap", `${roadmap}%`], ["Skills on target", `${onTarget}/${reqs.length}`]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="eyebrow">{l}</p>
            <p className="mt-2 font-display text-3xl font-bold">{applications.isPending && (l === "Jobs tracked" || l === "Applied or later") ? "—" : applications.isError && (l === "Jobs tracked" || l === "Applied or later") ? "—" : v}</p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-soft">
        <p className="eyebrow">Applications by stage</p>
        {applications.isPending ? <Skeleton className="mt-6 h-48 w-full" aria-label="Loading application activity" />
          : applications.isError ? <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 text-sm text-destructive">Couldn't load your applications.<Button variant="outline" size="sm" onClick={() => void applications.refetch()}>Retry</Button></div>
          : saved.length === 0 ? <div className="mt-6 py-10 text-center text-sm text-muted-foreground">Application activity will appear here after you add or save applications.</div>
          : <div className="mt-6 overflow-x-auto" role="img" aria-label={counts.map(({ label, count }) => `${label}: ${count}`).join(", ")}><div className={counts.length > 5 ? "h-48 min-w-[630px]" : "h-48 min-w-[460px]"}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={counts} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} height={32} angle={0} textAnchor="middle" />
                <YAxis allowDecimals={false} width={24} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", borderColor: "var(--border)", borderRadius: 8 }} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Bar dataKey="count" name="Applications" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
                  <LabelList dataKey="count" position="top" fill="var(--foreground)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div></div>}
      </section>
    </>
  );
}
