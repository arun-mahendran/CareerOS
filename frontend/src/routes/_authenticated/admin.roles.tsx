import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ROLE_REQUIREMENTS } from "@/lib/skills/model";
import { ROLE_NAMES } from "@/lib/roadmap/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({ meta: [{ title: "Roles & skills — CareerOS Admin" }, { name: "description", content: "Review the role skill maps used by CareerOS." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Roles & skills — CareerOS Admin" }, { property: "og:description", content: "Review the role skill maps used by CareerOS." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Roles,
});

function Roles() {
  const [selected, setSelected] = useState(ROLE_NAMES[0] ?? "");
  const requirements = ROLE_REQUIREMENTS[selected] ?? [];
  const groups = [
    ["Required skills", requirements.filter((r) => r.importance === "Required")],
    ["Preferred skills", requirements.filter((r) => r.importance === "Preferred")],
  ] as const;
  return (
    <AdminPage title="Roles & Skills" crumbs={[{ label: "Roles & Skills" }]} sub="The actual skill maps that power skill-gap analysis." live>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Panel title="Roles"><ul className="p-2">{ROLE_NAMES.map((role) => <li key={role}><button onClick={() => setSelected(role)} className={cn("w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted", role === selected && "bg-accent font-medium text-accent-foreground")}>{role}</button></li>)}</ul></Panel>
        <Panel title={selected} sub={`${requirements.length} configured skills`}>
          <div className="grid gap-px bg-border sm:grid-cols-2">{groups.map(([label, rows]) => <div key={label} className="bg-card p-5"><p className="text-sm font-medium">{label}</p><div className="mt-3 flex flex-wrap gap-1.5">{rows.map((r) => <span key={r.skill} className="rounded-md border bg-surface px-2 py-1 text-xs">{r.skill} · level {r.level}</span>)}</div></div>)}</div>
        </Panel>
      </div>
    </AdminPage>
  );
}
