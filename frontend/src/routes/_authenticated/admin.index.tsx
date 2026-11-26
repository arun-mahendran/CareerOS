import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Users, CalendarPlus, Sparkles, RefreshCw, Mail, AlertTriangle } from "lucide-react";
import { AdminPage, StatCard, Panel, Table, td, StatusBadge, Pipeline, btn, Empty } from "@/components/admin/ui";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, adminAnalytics, jobSources } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — CareerOS" }, { name: "description", content: "Real platform health overview." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Admin dashboard — CareerOS" }, { property: "og:description", content: "Real platform health overview." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

function Dashboard() {
  const q = useQuery({
    queryKey: ["admin", "dashboard-live"],
    enabled: USE_API,
    queryFn: async () => {
      const [overview, jobs, notifications, sources] = await Promise.all([
        adminAnalytics.overview({ days: 1 }), adminAnalytics.jobs({ days: 1 }), adminAnalytics.notifications({ days: 1 }), jobSources.list(),
      ]);
      return { overview, jobs, notifications, sources };
    },
  });
  if (!USE_API) return <BackendRequired title="Dashboard" sub="Platform health across sources, jobs and notifications." />;
  const d = q.data;
  return (
    <AdminPage title="Dashboard" sub="Platform health across sources, jobs and notifications." live>
      {q.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}</div>
        : q.isError || !d ? <Panel title="Could not load platform health"><div className="p-6 text-sm"><button className={btn} onClick={() => q.refetch()}>Try again</button></div></Panel>
        : <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active jobs" value={d.overview.jobs.active} icon={Briefcase} />
            <StatCard label="Companies" value={d.overview.companies.total} icon={Building2} />
            <StatCard label="Registered users" value={d.overview.users.total} icon={Users} />
            <StatCard label="Jobs added today" value={d.overview.jobs.new} icon={CalendarPlus} />
            <StatCard label="Applications added today" value={d.overview.applications.new} icon={Sparkles} />
            <StatCard label="Job updates in latest syncs" value={d.sources.reduce((n, s) => n + s.last_updated_count, 0)} icon={RefreshCw} />
            <StatCard label="Notifications created today" value={d.notifications.total} icon={Mail} />
            <StatCard label="Source sync errors" value={d.sources.filter((s) => s.status === "ERROR").length} icon={AlertTriangle} tone={d.sources.some((s) => s.status === "ERROR") ? "danger" : "default"} />
          </div>
          <Panel title="How jobs reach candidates" sub="From official career sources to follower notifications" className="mt-6"><Pipeline /></Panel>
          <Panel title="Job source health" right={<Link to="/admin/sources" className={btn}>All sources</Link>} className="mt-6">
            {d.sources.length === 0 ? <Empty text="No official job boards are configured yet." /> : <Table head={["Source", "Company", "Status", "Jobs", "Last successful sync", "Latest new jobs"]}>
              {d.sources.map((s) => <tr key={s.id} className="hover:bg-surface">
                <td className={`${td} font-medium`}>{s.name}</td><td className={td}>{s.company_name ?? "Not specified"}</td>
                <td className={td}><StatusBadge status={s.status === "OK" ? "Healthy" : s.status === "ERROR" ? "Error" : "Pending"} /></td>
                <td className={`${td} tabular-nums`}>{s.job_count}</td><td className={`${td} text-muted-foreground`}>{s.last_success_at ? new Date(s.last_success_at).toLocaleString() : "Never"}</td>
                <td className={`${td} tabular-nums`}>{s.last_new_count}</td>
              </tr>)}
            </Table>}
          </Panel>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Job activity" sub="Today and latest completed syncs">
              <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {[["New today", d.overview.jobs.new], ["Updated", d.sources.reduce((n, s) => n + s.last_updated_count, 0)], ["Expired", d.sources.reduce((n, s) => n + s.last_expired_count, 0)], ["Fetched", d.sources.reduce((n, s) => n + s.last_fetched_count, 0)]].map(([l, v]) => <div key={l} className="bg-card p-5"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{v}</dd></div>)}
              </dl>
            </Panel>
            <Panel title="Notification activity" sub="Today">
              <dl className="divide-y text-sm">
                {[["Notifications created", d.notifications.total], ["Read", d.notifications.read], ["Unread", d.notifications.total - d.notifications.read]].map(([l, v]) => <div key={l} className="flex justify-between px-5 py-3"><dt className="text-muted-foreground">{l}</dt><dd className="font-medium tabular-nums">{v}</dd></div>)}
                <div className="flex justify-between px-5 py-3"><dt className="text-muted-foreground">Email delivery</dt><dd className="text-xs text-muted-foreground">{d.notifications.email.configured ? "Configured; delivery rates unavailable" : "Not configured"}</dd></div>
              </dl>
            </Panel>
          </div>
        </>}
    </AdminPage>
  );
}
