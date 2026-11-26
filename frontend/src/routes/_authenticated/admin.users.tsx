import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminPage, Panel, StatCard, Table, td, StatusBadge, SearchInput, FilterSelect, usePaged, Pager, Empty, Confirm, btn } from "@/components/admin/ui";
import { BackendRequired } from "@/components/admin/backend-required";
import { USE_API, admin, adminAnalytics } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — CareerOS Admin" }, { name: "description", content: "Manage real candidate accounts." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Users — CareerOS Admin" }, { property: "og:description", content: "Manage real candidate accounts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "users-page"], enabled: USE_API, queryFn: async () => ({ users: await admin.users(), overview: await adminAnalytics.overview({ days: 30 }) }) });
  const [search, setSearch] = useState("");
  const [st, setSt] = useState("");
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => admin.setUserActive(id, active),
    onSuccess: (_r, v) => { toast.success(v.active ? "Account reactivated" : "Account suspended"); qc.invalidateQueries({ queryKey: ["admin", "users-page"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!USE_API) return <BackendRequired title="Users" sub="Candidate accounts on CareerOS." crumbs={[{ label: "Users" }]} />;
  const rows = q.data?.users ?? [];
  const filtered = rows.filter((u) => `${u.name ?? ""} ${u.email}`.toLowerCase().includes(search.toLowerCase()) && (!st || (st === "Active" ? u.is_active : !u.is_active)));
  const p = usePaged(filtered, 10);
  const week = Date.now() - 7 * 86400000;
  return (
    <AdminPage title="Users" crumbs={[{ label: "Users" }]} sub="Candidate accounts on CareerOS." live>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={q.data?.overview.users.total ?? "—"} />
        <StatCard label="Active accounts" value={q.data ? rows.filter((u) => u.is_active).length : "—"} />
        <StatCard label="New this week" value={q.data ? rows.filter((u) => new Date(u.created_at).getTime() >= week).length : "—"} />
        <StatCard label="Monthly active users" value={q.data?.overview.active_users.monthly ?? "—"} />
      </div>
      <Panel title="All users" right={q.isFetching ? <span className="text-xs text-muted-foreground">Refreshing…</span> : undefined}>
        <div className="flex flex-wrap gap-2 border-b px-5 py-3"><SearchInput value={search} onChange={setSearch} placeholder="Search name or email" /><FilterSelect label="Statuses" value={st} options={["Active", "Suspended"]} onChange={setSt} /></div>
        {q.isPending ? <Empty text="Loading real user accounts…" /> : q.isError ? <div className="p-6 text-sm"><button className={btn} onClick={() => q.refetch()}>Could not load users — try again</button></div> : p.total === 0 ? <Empty text="No user accounts match these filters." /> : <>
          <Table head={["Name", "Email", "Target role", "Joined", "Status", "Actions"]}>
            {p.slice.map((u) => <tr key={u.id} className="hover:bg-surface">
              <td className={`${td} font-medium`}>{u.name || "Not provided"}</td><td className={`${td} text-muted-foreground`}>{u.email}</td><td className={td}>{u.target_role || "Not provided"}</td>
              <td className={td}>{new Date(u.created_at).toLocaleDateString()}</td><td className={td}><StatusBadge status={u.is_active ? "Active" : "Suspended"} /></td>
              <td className={td}><DropdownMenu><DropdownMenuTrigger aria-label={`Actions for ${u.email}`} className="rounded-md p-1.5 hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end">
                {u.is_active ? <Confirm trigger={<button className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted">Suspend</button>} title={`Suspend ${u.email}?`} desc="They won't be able to sign in until reactivated." action="Suspend" onConfirm={() => toggle.mutate({ id: u.id, active: false })} />
                  : <DropdownMenuItem onSelect={() => toggle.mutate({ id: u.id, active: true })}>Reactivate</DropdownMenuItem>}
              </DropdownMenuContent></DropdownMenu></td>
            </tr>)}
          </Table><Pager {...p} /></>}
      </Panel>
    </AdminPage>
  );
}
