import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Building2, Download, FileText, Briefcase, Lightbulb, RefreshCw, TrendingUp, Users, Activity,
} from "lucide-react";
import { AdminPage, Empty, Panel, StatCard, StatusBadge, Table, btn, td } from "@/components/admin/ui";
import {
  USE_API, adminAnalytics, type AdminEngagement, type AdminJobsAnalytics, type AdminNotificationsAnalytics,
  type AdminOverview, type AdminUsersAnalytics, type AnalyticsQuery, type AdminInsights,
} from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Platform Analytics — CareerOS Admin" }, { name: "description", content: "Platform growth, job collection, engagement and notification analytics." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Platform Analytics — CareerOS Admin" }, { property: "og:description", content: "Platform growth, job collection, engagement and notification analytics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Analytics,
});

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "var(--popover-foreground)" }, itemStyle: { color: "var(--popover-foreground)" }, cursor: { fill: "var(--muted)" } };

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
] as const;

const FEATURE_LABELS: Record<string, string> = {
  JOB_VIEWED: "Opportunities",
  JOB_SEARCHED: "Opportunities search",
  RESUME_CREATED: "Resume Builder",
  SKILL_GAP_ANALYZED: "Skill Gap Analyzer",
  ROADMAP_GENERATED: "Career Roadmap",
  LEARNING_SAVED: "Learning Hub",
  INTERVIEW_STARTED: "Interview Preparation",
  APPLICATION_CREATED: "Applications Tracker",
};
const featureLabel = (kind: string) => FEATURE_LABELS[kind] ?? kind.replace(/_/g, " ").toLowerCase();

const fmtPeriod = (p: string) => (p.length === 7 ? p : new Date(p + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }));

function Chart({ title, sub, children, empty }: { title: string; sub?: string; children: ReactNode; empty?: boolean }) {
  return (
    <Panel title={title} {...(sub ? { sub } : {})}>
      {empty ? <Empty text="No recorded data for the selected period." /> : (
        <div className="h-60 p-4"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
      )}
    </Panel>
  );
}

function Bars({ data, x, y, layout }: { data: object[]; x: string; y: string; layout?: "vertical" }) {
  return layout ? (
    <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
      <CartesianGrid horizontal={false} stroke="var(--border)" />
      <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis type="category" dataKey={x} tick={axis} axisLine={false} tickLine={false} width={130} />
      <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
      <Bar dataKey={y} fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
    </BarChart>
  ) : (
    <BarChart data={data}>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} tickFormatter={fmtPeriod} />
      <YAxis tick={axis} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
      <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} labelFormatter={(l) => String(l)} />
      <Bar dataKey={y} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-label="Loading analytics">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl border bg-muted/40" />)}
    </div>
  );
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(data: { overview: AdminOverview; users: AdminUsersAnalytics; jobs: AdminJobsAnalytics; engagement: AdminEngagement; notifications: AdminNotificationsAnalytics }) {
  const rows: (string | number)[][] = [["CareerOS platform analytics", `${data.overview.range.start} to ${data.overview.range.end}`], []];
  rows.push(["KPI", "Value"],
    ["Total registered users", data.overview.users.total], ["New users in period", data.overview.users.new],
    ["User growth vs previous period (%)", data.overview.users.growth_pct ?? "n/a"],
    ["Active jobs", data.overview.jobs.active], ["New jobs in period", data.overview.jobs.new],
    ["Companies tracked", data.overview.companies.total], ["Companies with job sources", data.overview.companies.with_sources],
    ["Daily active users", data.overview.active_users.daily], ["Monthly active users", data.overview.active_users.monthly],
    ["Total applications", data.overview.applications.total], ["New applications in period", data.overview.applications.new],
    ["Activity events in period", data.overview.engagement.events], []);
  rows.push(["New registrations per " + data.users.range.bucket]);
  data.users.registrations.forEach((p) => rows.push([p.period, p.count]));
  rows.push([], ["New jobs per " + data.jobs.range.bucket]);
  data.jobs.new_per_period.forEach((p) => rows.push([p.period, p.count]));
  rows.push([], ["Jobs by company"]); data.jobs.by_company.forEach((r) => rows.push([r.name, r.jobs]));
  rows.push([], ["Jobs by role"]); data.jobs.by_role.forEach((r) => rows.push([r.name, r.jobs]));
  rows.push([], ["Jobs by location"]); data.jobs.by_location.forEach((r) => rows.push([r.name, r.jobs]));
  rows.push([], ["Most followed companies"]); data.engagement.most_followed.forEach((r) => rows.push([r.name, r.followers]));
  rows.push([], ["Most searched roles"]); data.engagement.searched_roles.forEach((r) => rows.push([r.term, r.count]));
  rows.push([], ["Feature usage"]); data.engagement.feature_usage.forEach((r) => rows.push([featureLabel(r.kind), r.events]));
  rows.push([], ["Notifications by type"]); data.notifications.by_type.forEach((r) => rows.push([r.type, r.count]));
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function Analytics() {
  const [days, setDays] = useState<number>(30);
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const query: AnalyticsQuery = custom ?? { days };
  const rangeKey = custom ? `${custom.start}_${custom.end}` : `d${days}`;

  const q = useQuery({
    queryKey: ["admin-analytics", rangeKey],
    enabled: USE_API,
    queryFn: async () => {
      const [overview, users, jobs, engagement, notifications, insights] = await Promise.all([
        adminAnalytics.overview(query), adminAnalytics.users(query), adminAnalytics.jobs(query),
        adminAnalytics.engagement(query), adminAnalytics.notifications(query), adminAnalytics.insights(query),
      ]);
      return { overview, users, jobs, engagement, notifications, insights, fetchedAt: new Date() };
    },
  });

  const regTrend = useMemo(() => {
    if (!q.data) return [];
    const cum = new Map(q.data.users.cumulative.map((p) => [p.period, p.count]));
    return q.data.users.registrations.map((p) => ({ period: p.period, newUsers: p.count, total: cum.get(p.period) ?? p.count }));
  }, [q.data]);

  const exportCsv = () => {
    if (!q.data) return;
    const blob = new Blob([toCsv(q.data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `careeros-analytics-${q.data.overview.range.start}_${q.data.overview.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Date range"
        value={custom ? "custom" : String(days)}
        onChange={(e) => {
          if (e.target.value === "custom") {
            const end = new Date().toISOString().slice(0, 10);
            const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
            setCustom({ start, end });
          } else {
            setCustom(null);
            setDays(Number(e.target.value));
          }
        }}
        className="rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {RANGES.map((r) => <option key={r.days} value={String(r.days)}>{r.label}</option>)}
        <option value="custom">Custom range</option>
      </select>
      {custom && (
        <>
          <input type="date" aria-label="Start date" value={custom.start} max={custom.end}
            onChange={(e) => setCustom({ ...custom, start: e.target.value })} className="rounded-lg border bg-background px-2 py-1.5 text-xs" />
          <input type="date" aria-label="End date" value={custom.end} min={custom.start}
            onChange={(e) => setCustom({ ...custom, end: e.target.value })} className="rounded-lg border bg-background px-2 py-1.5 text-xs" />
        </>
      )}
      <button className={btn} onClick={() => q.refetch()} disabled={q.isFetching}>
        <RefreshCw className={q.isFetching ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
      </button>
      <button className={btn} onClick={exportCsv} disabled={!q.data}>
        <Download className="size-3.5" /> Export CSV
      </button>
      {q.data && (
        <span className="text-[11px] text-muted-foreground">
          Updated {q.data.fetchedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );

  if (!USE_API) {
    return (
      <AdminPage title="Platform Analytics" crumbs={[{ label: "Analytics" }]} sub="Monitor platform growth, job collection, user engagement, and overall CareerOS performance." live>
        <Panel title="Live backend not connected">
          <Empty text="Platform analytics are served by the FastAPI backend. Set VITE_API_URL to your backend URL and sign in as an admin to see real figures." />
        </Panel>
      </AdminPage>
    );
  }

  const d = q.data;
  return (
    <AdminPage title="Platform Analytics" crumbs={[{ label: "Analytics" }]} sub="Monitor platform growth, job collection, user engagement, and overall CareerOS performance." right={controls} live>
      {q.isLoading ? <Skeleton /> : q.isError ? (
        <Panel title="Could not load analytics">
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-sm">
            <p className="text-muted-foreground">{q.error instanceof Error ? q.error.message : "Something went wrong while loading analytics."}</p>
            <button className={btn} onClick={() => q.refetch()}><RefreshCw className="size-3.5" /> Try again</button>
          </div>
        </Panel>
      ) : d ? (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total registered users" value={d.overview.users.total} icon={Users}
              hint={d.overview.users.growth_pct != null
                ? `${d.overview.users.new} new · ${d.overview.users.growth_pct > 0 ? "+" : ""}${d.overview.users.growth_pct}% vs previous period`
                : `${d.overview.users.new} new in period`} />
            <StatCard label="Jobs collected" value={d.overview.jobs.active} icon={Briefcase} hint={`${d.overview.jobs.new} new in period`} />
            <StatCard label="Companies tracked" value={d.overview.companies.total} icon={Building2}
              hint={`${d.overview.companies.with_sources} with job sources · ${d.overview.companies.new} new`} />
            <StatCard label="Active users" value={d.overview.active_users.monthly} icon={Activity}
              hint={`${d.overview.active_users.daily} daily · ${d.overview.active_users.monthly} monthly`} />
            <StatCard label="Applications tracked" value={d.overview.applications.total} icon={FileText} hint={`${d.overview.applications.new} new in period`} />
            <StatCard label="Platform engagement" value={d.overview.engagement.events} icon={TrendingUp} hint="Recorded activity events in period" />
          </div>

          {/* Growth */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="User registration trends" sub={`New and cumulative registrations · ${d.users.range.bucket}`} empty={!regTrend.some((p) => p.newUsers > 0 || p.total > 0)}>
              <ComposedChart data={regTrend}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" tick={axis} axisLine={false} tickLine={false} tickFormatter={fmtPeriod} />
                <YAxis yAxisId="l" tick={axis} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" tick={axis} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip {...tip} />
                <Bar yAxisId="l" dataKey="newUsers" name="New users" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" dataKey="total" name="Total users" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </Chart>
            <Chart title="Platform activity trends" sub="Recorded activity events" empty={!d.users.activity.some((p) => p.count > 0)}>
              <AreaChart data={d.users.activity}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" tick={axis} axisLine={false} tickLine={false} tickFormatter={fmtPeriod} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip {...tip} />
                <Area dataKey="count" name="Events" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </Chart>
          </div>

          {/* Job ecosystem */}
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Job ecosystem</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="New jobs per day" sub="Jobs collected from configured sources" empty={!d.jobs.new_per_period.some((p) => p.count > 0)}>
              <Bars data={d.jobs.new_per_period} x="period" y="count" />
            </Chart>
            <Chart title="Jobs by company" sub="Top companies by active jobs" empty={d.jobs.by_company.length === 0}>
              <Bars data={d.jobs.by_company} x="name" y="jobs" layout="vertical" />
            </Chart>
            <Chart title="Jobs by role" sub="Most common active job titles" empty={d.jobs.by_role.length === 0}>
              <Bars data={d.jobs.by_role} x="name" y="jobs" layout="vertical" />
            </Chart>
            <Chart title="Jobs by location" sub="Most common active job locations" empty={d.jobs.by_location.length === 0}>
              <Bars data={d.jobs.by_location} x="name" y="jobs" layout="vertical" />
            </Chart>
          </div>
          <Panel title="Job source performance" sub="Collection results per configured source">
            {d.jobs.sources.length === 0 ? <Empty text="No job sources configured yet." /> : (
              <Table head={["Source", "Status", "Active jobs", "Last sync (fetched / new / expired)", "Last success", "Last error"]}>
                {d.jobs.sources.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>{s.name}{s.is_demo ? <span className="ml-2 text-[11px] text-muted-foreground">(demo)</span> : null}</td>
                    <td className={td}><StatusBadge status={s.status === "OK" ? "Healthy" : s.status === "ERROR" ? "Error" : s.enabled ? "Pending" : "Low"} /></td>
                    <td className={`${td} tabular-nums`}>{s.jobs}</td>
                    <td className={`${td} tabular-nums`}>{s.last_fetched} / {s.last_new} / {s.last_expired}</td>
                    <td className={td}>{s.last_success_at ? new Date(s.last_success_at).toLocaleString() : "—"}</td>
                    <td className={`${td} max-w-56 truncate text-muted-foreground`}>{s.last_error ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          {/* Engagement */}
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">User engagement</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="Most followed companies" sub="Follower counts across all users" empty={d.engagement.most_followed.length === 0}>
              <Bars data={d.engagement.most_followed} x="name" y="followers" layout="vertical" />
            </Chart>
            <Chart title="Feature usage" sub="Recorded interactions in the selected period" empty={d.engagement.feature_usage.length === 0}>
              <Bars data={d.engagement.feature_usage.map((f) => ({ name: featureLabel(f.kind), events: f.events }))} x="name" y="events" layout="vertical" />
            </Chart>
            <Panel title="Most searched roles" sub="Opportunities searches in the selected period">
              {d.engagement.searched_roles.length === 0
                ? <Empty text="No searches recorded in this period. Search tracking began with this release." />
                : (
                  <ol className="divide-y text-sm">
                    {d.engagement.searched_roles.map((r, i) => (
                      <li key={r.term} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="flex-1 truncate">{r.term}</span>
                        <span className="text-muted-foreground tabular-nums">{r.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
            </Panel>
            <Panel title="User activity" sub="Distinct users with recorded activity">
              <ul className="divide-y text-sm">
                {([
                  ["Daily active users", d.engagement.activity.daily_active],
                  ["Weekly active users", d.engagement.activity.weekly_active],
                  ["Monthly active users", d.engagement.activity.monthly_active],
                  ["Active in selected period", d.engagement.activity.active_in_range],
                  ["New registrations in period", d.engagement.activity.new_registrations],
                  ["Returning users in period", d.engagement.activity.returning_users],
                ] as const).map(([l, v]) => (
                  <li key={l} className="flex justify-between px-5 py-2.5"><span className="text-muted-foreground">{l}</span><span className="font-medium tabular-nums">{v}</span></li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Notifications */}
          <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Notifications</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="Notification activity" sub={`Notifications generated · ${d.notifications.range.bucket}`} empty={!d.notifications.series.some((p) => p.count > 0)}>
              <AreaChart data={d.notifications.series}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="period" tick={axis} axisLine={false} tickLine={false} tickFormatter={fmtPeriod} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip {...tip} />
                <Area dataKey="count" name="Notifications" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </Chart>
            <Panel title="Notification performance" sub={`${d.notifications.total} generated in period · ${d.notifications.read} read`}>
              <ul className="divide-y text-sm">
                {d.notifications.by_type.map((t) => (
                  <li key={t.type} className="flex justify-between px-5 py-2.5">
                    <span className="text-muted-foreground">{t.type.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="font-medium tabular-nums">{t.count}</span>
                  </li>
                ))}
                <li className="flex justify-between px-5 py-2.5">
                  <span className="text-muted-foreground">Email delivery / open / click-through</span>
                  <span className="text-xs font-medium text-muted-foreground">Not configured</span>
                </li>
              </ul>
              <p className="border-t px-5 py-3 text-[11px] text-muted-foreground">{d.notifications.email.note}</p>
            </Panel>
          </div>

          {/* Insights */}
          <Panel title="Platform Insights" sub="Observations calculated from the data above" >
            {d.insights.insights.length === 0 ? <Empty text="Not enough data in the selected period to derive insights." /> : (
              <ul className="divide-y text-sm">
                {d.insights.insights.map((i) => (
                  <li key={i.kind + i.text} className="flex items-start gap-3 px-5 py-3">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </AdminPage>
  );
}
