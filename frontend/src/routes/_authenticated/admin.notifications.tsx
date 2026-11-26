import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, Panel, StatCard, Table, td, Empty, btn } from "@/components/admin/ui";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, adminAnalytics } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CareerOS Admin" }, { name: "description", content: "Real notification activity and email configuration." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Notifications — CareerOS Admin" }, { property: "og:description", content: "Real notification activity and email configuration." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Notifs,
});

function Notifs() {
  const q = useQuery({ queryKey: ["admin", "notifications", 30], queryFn: () => adminAnalytics.notifications({ days: 30 }), enabled: USE_API });
  if (!USE_API) return <BackendRequired title="Notifications" sub="Real notification activity for the last 30 days." crumbs={[{ label: "Notifications" }]} />;
  const d = q.data;
  return (
    <AdminPage title="Notifications" crumbs={[{ label: "Notifications" }]} sub="Notification records created during the last 30 days." live>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Notifications created" value={d?.total ?? "—"} /><StatCard label="Read" value={d?.read ?? "—"} />
        <StatCard label="Unread" value={d ? d.total - d.read : "—"} /><StatCard label="Email delivery" value={d ? (d.email.configured ? "Configured" : "Not configured") : "—"} />
      </div>
      <Panel title="Notifications by type" sub="Recipient-level email delivery and open rates are not available.">
        {q.isPending ? <Empty text="Loading real notification activity…" /> : q.isError ? <div className="p-6"><button className={btn} onClick={() => q.refetch()}>Could not load notifications — try again</button></div> : !d?.by_type.length ? <Empty text="No notifications were created in this period." /> : <Table head={["Type", "Created"]}>
          {d.by_type.map((n) => <tr key={n.type}><td className={`${td} font-medium`}>{n.type.replaceAll("_", " ")}</td><td className={`${td} tabular-nums`}>{n.count}</td></tr>)}
        </Table>}
      </Panel>
      {d && <p className="mt-4 text-xs text-muted-foreground">{d.email.note}</p>}
    </AdminPage>
  );
}
