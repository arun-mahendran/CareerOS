import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AdminPage, Empty, Panel, StatCard, btn } from "@/components/admin/ui";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, admin, adminAnalytics, jobSources } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/companies/$companyId")({
  head: () => ({ meta: [{ title: "Company — CareerOS Admin" }, { name: "description", content: "Real company monitoring details." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Company — CareerOS Admin" }, { property: "og:description", content: "Real company monitoring details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Detail,
});

function Detail() {
  const { companyId } = Route.useParams();
  const q = useQuery({ queryKey: ["admin", "companies"], enabled: USE_API, queryFn: async () => ({ companies: await admin.companies(), analytics: await adminAnalytics.jobs({ days: 30 }), sources: await jobSources.list() }) });
  if (!USE_API) return <BackendRequired title="Company" sub="Company monitoring details." />;
  const c = q.data?.companies.find((x) => x.id === companyId);
  const sources = q.data?.sources.filter((s) => s.company_id === companyId) ?? [];
  const jobs = q.data?.analytics.by_company.find((x) => x.name === c?.name)?.jobs ?? 0;
  return (
    <AdminPage title={c?.name ?? "Company"} crumbs={[{ label: "Companies", to: "/admin/companies" }, { label: c?.name ?? "Company" }]} sub={c?.industry ?? "Real company record"} right={<Link to="/admin/jobs" className={btn}>View jobs</Link>} live>
      {q.isPending ? <Empty text="Loading company details…" /> : q.isError ? <button className={btn} onClick={() => q.refetch()}>Could not load company — try again</button> : !c ? <Empty text="Company not found." /> : <>
        <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Active jobs" value={jobs} /><StatCard label="Configured sources" value={sources.length} /><StatCard label="Healthy sources" value={sources.filter((s) => s.monitored).length} /></div>
        <Panel title="Official links" className="mt-6"><dl className="divide-y text-sm">
          {[["Official website", c.website_url], ["Official career page", c.careers_url]].map(([l, u]) => <div key={l} className="flex flex-wrap justify-between gap-2 px-5 py-3"><dt className="text-muted-foreground">{l}</dt><dd>{u ? <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">{u} <ExternalLink className="size-3" /></a> : "Not provided"}</dd></div>)}
        </dl></Panel>
        <Panel title="Job sources" className="mt-6">{sources.length === 0 ? <Empty text="No official job board is configured for this company." /> : <ul className="divide-y">{sources.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span>{s.name}<span className="block text-xs text-muted-foreground">{s.provider} · {s.board_token}</span></span><Link to="/admin/sources" className={btn}>Manage source</Link></li>)}</ul>}</Panel>
      </>}
    </AdminPage>
  );
}
