import { Link } from "@tanstack/react-router";
import { LIFECYCLE } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Logo({ to = "/" }: { to?: "/" | "/dashboard" | "/admin" }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-soft">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 17l5-5 4 4 7-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-display text-[15px] font-bold tracking-tight">CareerOS</span>
    </Link>
  );
}

export function Lifecycle({ active = 0, compact = false }: { active?: number; compact?: boolean }) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-y-2", compact ? "gap-x-1" : "gap-x-2")}>
      {LIFECYCLE.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              i < active && "text-foreground",
              i === active && "bg-accent text-accent-foreground",
              i > active && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                i < active ? "bg-success" : i === active ? "bg-primary" : "bg-border",
              )}
            />
            {s}
          </span>
          {i < LIFECYCLE.length - 1 && <span className="text-border">/</span>}
        </li>
      ))}
    </ol>
  );
}

export function MatchRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" strokeWidth="3" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-primary"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-semibold">{value}</span>
    </div>
  );
}

export function CompanyMark({ name }: { name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-surface font-display text-sm font-bold">
      {name[0]}
    </span>
  );
}
