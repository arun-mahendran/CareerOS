import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Sep, Inbox, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PIPELINE } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export function AdminPage({ title, sub, crumbs = [], right, children, live = false }: { title: string; sub?: string; crumbs?: { label: string; to?: string }[]; right?: ReactNode; children: ReactNode; live?: boolean }) {
  return (
    <div className="animate-rise">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground">Admin</Link>
        {crumbs.map((c) => (
          <span key={c.label} className="flex items-center gap-1">
            <Sep className="size-3" />
            {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon?: React.ComponentType<{ className?: string }>; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : "text-muted-foreground")} />}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone === "danger" && "text-destructive")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ title, sub, right, children, className }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-soft", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </header>
      <div>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  Healthy: "bg-success/10 text-success border-success/20",
  Active: "bg-success/10 text-success border-success/20",
  Delivered: "bg-success/10 text-success border-success/20",
  On: "bg-success/10 text-success border-success/20",
  Premium: "bg-primary/10 text-primary border-primary/20",
  New: "bg-primary/10 text-primary border-primary/20",
  Syncing: "bg-primary/10 text-primary border-primary/20",
  Updated: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  Warning: "bg-warning/15 text-warning border-warning/30",
  Pending: "bg-warning/15 text-warning border-warning/30",
  Duplicate: "bg-warning/15 text-warning border-warning/30",
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-warning/15 text-warning border-warning/30",
  Low: "bg-muted text-muted-foreground border-border",
  Error: "bg-destructive/10 text-destructive border-destructive/20",
  Failed: "bg-destructive/10 text-destructive border-destructive/20",
  Reported: "bg-destructive/10 text-destructive border-destructive/20",
  Suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONES[status] ?? "bg-muted text-muted-foreground border-border")}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "Syncing" && "animate-pulse")} />
      {status}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring">
      <Search className="size-4 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
    </label>
  );
}

export function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
      <option value="">All {label.toLowerCase()}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-surface text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-5 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "whitespace-nowrap px-5 py-3";

export function Empty({ text = "Nothing matches these filters." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" /> {text}
    </div>
  );
}

export function usePaged<T>(rows: T[], size = 8) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  const slice = useMemo(() => rows.slice((cur - 1) * size, cur * size), [rows, cur, size]);
  return { slice, page: cur, pages, setPage, total: rows.length };
}

export function Pager({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
      <span>{total} results · page {page} of {pages}</span>
      <div className="flex gap-1">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
        <button aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
      </div>
    </div>
  );
}

export function Confirm({ trigger, title, desc, action, onConfirm }: { trigger: ReactNode; title: string; desc: string; action: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const btn = "inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Pipeline({ active }: { active?: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 px-5 py-4">
      {PIPELINE.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span className={cn("rounded-lg border px-3 py-1.5 text-xs", i === active ? "border-primary/30 bg-primary/10 font-medium text-primary" : "bg-surface")}>
            <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}</span>{step}
          </span>
          {i < PIPELINE.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
        </li>
      ))}
    </ol>
  );
}
