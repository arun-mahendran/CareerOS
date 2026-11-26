import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel, Table, td, StatusBadge, SearchInput, FilterSelect, usePaged, Pager, Empty, btn } from "@/components/admin/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, admin } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  head: () => ({ meta: [{ title: "Jobs — CareerOS Admin" }, { name: "description", content: "Manage real aggregated job listings." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Jobs — CareerOS Admin" }, { property: "og:description", content: "Manage real aggregated job listings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Jobs,
});

function Jobs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "jobs"], queryFn: admin.jobs, enabled: USE_API });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const expire = useMutation({
    mutationFn: (id: string) => admin.updateJob(id, { status: "EXPIRED" }),
    onSuccess: () => { toast.success("Listing marked as expired"); qc.invalidateQueries({ queryKey: ["admin", "jobs"] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = useMemo(() => (q.data ?? []).filter((j) => (!search || `${j.title} ${j.company}`.toLowerCase().includes(search.toLowerCase())) && (!status || j.status === status)), [q.data, search, status]);
  const p = usePaged(rows, 10);
  if (!USE_API) return <BackendRequired title="Jobs" sub="Real listings collected from official sources." crumbs={[{ label: "Jobs" }]} />;
  return (
    <AdminPage title="Jobs" crumbs={[{ label: "Jobs" }]} sub="CareerOS aggregates listings from official sources. Candidates always apply on the employer's own portal." live>
      <Panel title="All jobs" right={<span className="text-xs text-muted-foreground">{rows.length} listings</span>}>
        <div className="flex flex-wrap gap-2 border-b px-5 py-3"><SearchInput value={search} onChange={setSearch} placeholder="Search title or company" /><FilterSelect label="Statuses" value={status} options={["ACTIVE", "EXPIRED"]} onChange={setStatus} /></div>
        {q.isPending ? <Empty text="Loading real job listings…" /> : q.isError ? <div className="p-6"><button className={btn} onClick={() => q.refetch()}>Could not load jobs — try again</button></div> : p.total === 0 ? <Empty text="No real listings match these filters." /> : <>
          <Table head={["Company", "Job title", "Location", "Posted", "Source", "Status", "Actions"]}>
            {p.slice.map((j) => <tr key={j.id} className="hover:bg-surface">
              <td className={`${td} font-medium`}>{j.company}</td><td className={td}>{j.title}</td><td className={td}>{j.location}</td>
              <td className={`${td} text-muted-foreground`}>{new Date(j.posted_at).toLocaleDateString()}</td><td className={`${td} text-xs text-muted-foreground`}>{j.source}</td>
              <td className={td}><StatusBadge status={j.status === "ACTIVE" ? "Active" : "Expired"} /></td>
              <td className={td}><DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${j.title}`} className="rounded-md p-1.5 hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end">
                <DropdownMenuItem asChild><a href={j.official_url} target="_blank" rel="noreferrer" className="gap-2">View official source <ExternalLink className="size-3" /></a></DropdownMenuItem>
                {j.status === "ACTIVE" && <DropdownMenuItem onSelect={() => expire.mutate(j.id)}>Mark expired</DropdownMenuItem>}
              </DropdownMenuContent></DropdownMenu></td>
            </tr>)}
          </Table><Pager {...p} /></>}
      </Panel>
    </AdminPage>
  );
}
