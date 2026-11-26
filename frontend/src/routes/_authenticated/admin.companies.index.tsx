import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage, Panel, Table, td, SearchInput, Empty, btn } from "@/components/admin/ui";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, admin, adminAnalytics, jobSources } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/companies/")({
  head: () => ({ meta: [{ title: "Companies — CareerOS Admin" }, { name: "description", content: "Real monitored company directory." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Companies — CareerOS Admin" }, { property: "og:description", content: "Real monitored company directory." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Companies,
});

function Companies() {
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["admin", "companies"], enabled: USE_API, queryFn: async () => ({ companies: await admin.companies(), analytics: await adminAnalytics.jobs({ days: 30 }), sources: await jobSources.list() }) });
  if (!USE_API) return <BackendRequired title="Companies" sub="Employers whose official career sources CareerOS monitors." crumbs={[{ label: "Companies" }]} />;
  const counts = new Map(q.data?.analytics.by_company.map((r) => [r.name, r.jobs]) ?? []);
  const rows = (q.data?.companies ?? []).filter((c) => `${c.name} ${c.industry ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <AdminPage title="Companies" crumbs={[{ label: "Companies" }]} sub="Employers whose official career sources CareerOS monitors." live>
      <Panel title="Company directory">
        <div className="border-b px-5 py-3"><SearchInput value={search} onChange={setSearch} placeholder="Search companies" /></div>
        {q.isPending ? <Empty text="Loading real companies…" /> : q.isError ? <div className="p-6"><button className={btn} onClick={() => q.refetch()}>Could not load companies — try again</button></div> : rows.length === 0 ? <Empty text="No companies match. Companies appear after an official board is added." /> : <Table head={["Company", "Industry", "Active jobs", "Job sources", "Actions"]}>
          {rows.map((c) => <tr key={c.id} className="hover:bg-surface">
            <td className={`${td} font-medium`}><span className="mr-2 inline-grid size-7 place-items-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">{c.name[0]}</span>{c.name}</td>
            <td className={td}>{c.industry ?? "Not specified"}</td><td className={`${td} tabular-nums`}>{counts.get(c.name) ?? 0}</td>
            <td className={`${td} tabular-nums`}>{q.data?.sources.filter((s) => s.company_id === c.id).length ?? 0}</td>
            <td className={td}><Link to="/admin/companies/$companyId" params={{ companyId: c.id }} className={btn}>Details</Link></td>
          </tr>)}
        </Table>}
      </Panel>
    </AdminPage>
  );
}
