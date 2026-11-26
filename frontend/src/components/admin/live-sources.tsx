import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlaskConical, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AdminPage, Confirm, Panel, StatusBadge, Pipeline, StatCard, btn, btnPrimary } from "@/components/admin/ui";
import { jobSources, type JobSourceRecord, type SyncResult } from "@/services/backend";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { key: "greenhouse", label: "Greenhouse", hint: "boards.greenhouse.io/<board>" },
  { key: "lever", label: "Lever", hint: "jobs.lever.co/<site>" },
  { key: "ashby", label: "Ashby", hint: "jobs.ashbyhq.com/<board>" },
];

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "never";
}

function label(s: JobSourceRecord) {
  if (!s.enabled) return "Disabled";
  if (s.syncing) return "Syncing";
  if (s.status === "ERROR") return "Error";
  if (s.monitored) return "Healthy";
  return s.validated_at ? "Verified" : "Unverified";
}

function describe(r: SyncResult) {
  return r.ok ? `${r.fetched} listings · ${r.new} new · ${r.updated} updated · ${r.expired} expired` : r.error ?? "Failed";
}

/** Real job-source management backed by the CareerOS server. */
export function LiveSources() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "job-sources"], queryFn: jobSources.list, refetchInterval: 30_000 });
  const [form, setForm] = useState({ provider: "greenhouse", board_token: "", company_name: "", careers_url: "", region: "global" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "job-sources"] });

  const create = useMutation({
    mutationFn: () => jobSources.create({ ...form, careers_url: form.careers_url || undefined }),
    onSuccess: (s) => { toast.success(`${s.name} added — run Test to verify the board`); setForm((f) => ({ ...f, board_token: "", company_name: "", careers_url: "" })); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const act = useMutation({
    mutationFn: async ({ s, kind }: { s: JobSourceRecord; kind: "test" | "sync" }) => ({ s, kind, r: await jobSources[kind](s.id) }),
    onSuccess: ({ s, kind, r }) => { (r.ok ? toast.success : toast.error)(`${s.name} ${kind}: ${describe(r)}`); refresh(); qc.invalidateQueries({ queryKey: ["opportunities"] }); },
    onError: (e) => { toast.error((e as Error).message); refresh(); },
  });
  const toggle = useMutation({
    mutationFn: ({ s, enabled }: { s: JobSourceRecord; enabled: boolean }) => jobSources.update(s.id, { enabled }),
    onSuccess: (s) => { toast.success(s.enabled ? "Source enabled" : "Source disabled"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (s: JobSourceRecord) => jobSources.remove(s.id),
    onSuccess: (r, s) => { toast.success(`${s.name} deleted — ${r.jobs_removed} listings removed`); refresh(); qc.invalidateQueries({ queryKey: ["opportunities"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = list.data ?? [];
  const real = rows;
  const healthy = real.filter((s) => s.monitored).length;
  const lastOk = real.map((s) => s.last_success_at).filter(Boolean).sort().at(-1) ?? null;
  const field = "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <AdminPage live title="Job Sources" crumbs={[{ label: "Job Sources" }]} sub="Official company job boards CareerOS monitors for new roles.">
      <Panel title="Monitoring workflow"><Pipeline active={1} /></Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-xl border bg-card p-5 shadow-soft">
          <p className="text-xs text-muted-foreground">Monitored boards</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{healthy} / {real.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">A board counts as monitored after a successful sync against the real API.</p>
        </section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Last successful" value={lastOk ? new Date(lastOk).toLocaleTimeString() : "—"} />
          <StatCard label="Sources in error" value={real.filter((s) => s.status === "ERROR").length} tone="danger" />
          <StatCard label="New (last run)" value={real.reduce((a, s) => a + s.last_new_count, 0)} />
          <StatCard label="Live jobs" value={real.reduce((a, s) => a + s.job_count, 0)} />
        </div>
      </div>

      <Panel title="Add a company board" sub="Use the board identifier from the company's official careers page. Nothing is guessed — the board is verified against the provider's public API." className="mt-6">
        <form className="flex flex-wrap items-end gap-3 p-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <label className="grid gap-1 text-xs">Provider
            <select className={field} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs">Board identifier
            <input required pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,119}" className={field} placeholder={PROVIDERS.find((p) => p.key === form.provider)?.hint} value={form.board_token} onChange={(e) => setForm({ ...form, board_token: e.target.value })} />
          </label>
          <label className="grid gap-1 text-xs">Company name
            <input required className={field} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </label>
          <label className="grid gap-1 text-xs">Careers page (optional)
            <input type="url" className={field} placeholder="https://" value={form.careers_url} onChange={(e) => setForm({ ...form, careers_url: e.target.value })} />
          </label>
          {form.provider === "lever" && (
            <label className="grid gap-1 text-xs">Region
              <select className={field} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option value="global">Global</option><option value="eu">EU</option></select>
            </label>
          )}
          <button type="submit" disabled={create.isPending} className={btnPrimary}><Plus className="size-3" /> Add source</button>
        </form>
      </Panel>

      {list.isError && <p className="mt-6 text-sm text-destructive">Couldn't load sources. <button className="underline" onClick={() => list.refetch()}>Retry</button></p>}
      {list.isSuccess && real.length === 0 && (
        <p className="mt-6 rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-soft">No company boards yet. Add one above — you'll need the provider (Greenhouse, Lever or Ashby) and the company's board identifier.</p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {real.map((s) => (
          <article key={s.id} className="rounded-xl border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-medium">{s.name}</h3><p className="text-xs text-muted-foreground">{`${s.provider} · ${s.board_token}${s.region === "eu" ? " (EU)" : ""}`}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={label(s)} />
                <Confirm
                  trigger={
                    <button
                      aria-label={`Delete job source ${s.name}`}
                      title="Delete job source"
                      disabled={del.isPending}
                      className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                  title={`Delete ${s.name}?`}
                  desc={`Are you sure you want to delete this job source for ${s.name} (${s.provider})? Its ${s.job_count} active listings will be removed from Opportunities. Saved applications and resumes are kept. This action cannot be undone.`}
                  action="Delete Source"
                  onConfirm={() => del.mutate(s)}
                />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div><dt className="text-muted-foreground">Active jobs</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{s.job_count}</dd></div>
              <div><dt className="text-muted-foreground">New last run</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{s.last_new_count}</dd></div>
              <div><dt className="text-muted-foreground">Updated</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{s.last_updated_count}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Last success {when(s.last_success_at)} · checked {when(s.last_checked_at)}</p>
            {s.last_error && <p className={cn("mt-2 text-xs text-destructive")}>{s.last_error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <button className={btn} disabled={act.isPending} onClick={() => act.mutate({ s, kind: "test" })}><FlaskConical className="size-3" /> Test</button>
              <button className={btn} disabled={act.isPending || !s.enabled} onClick={() => act.mutate({ s, kind: "sync" })}><RefreshCw className={cn("size-3", act.isPending && act.variables?.s.id === s.id && "animate-spin")} /> Sync now</button>
              <Switch className="ml-auto" aria-label={`Enable ${s.name}`} checked={s.enabled} onCheckedChange={(v) => toggle.mutate({ s, enabled: v })} />
            </div>
          </article>
        ))}
      </div>
    </AdminPage>
  );
}
