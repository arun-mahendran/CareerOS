import { AdminPage, Empty, Panel } from "@/components/admin/ui";

export function BackendRequired({ title, sub, crumbs = [] }: { title: string; sub: string; crumbs?: { label: string; to?: string }[] }) {
  return (
    <AdminPage title={title} sub={sub} crumbs={crumbs} live>
      <Panel title="Live backend not connected">
        <Empty text="This page shows real server records only. Set VITE_API_URL to your CareerOS FastAPI URL and sign in as an admin." />
      </Panel>
    </AdminPage>
  );
}
