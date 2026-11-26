import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ACTIVITIES, ROLE_ROADMAPS } from "@/lib/roadmap/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roadmaps")({
  head: () => ({ meta: [{ title: "Roadmaps — CareerOS Admin" }, { name: "description", content: "Review the actual role-based learning roadmaps." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Roadmaps — CareerOS Admin" }, { property: "og:description", content: "Review the actual role-based learning roadmaps." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Roadmaps,
});

function Roadmaps() {
  const [selected, setSelected] = useState(ROLE_ROADMAPS[0]?.role ?? "");
  const roadmap = ROLE_ROADMAPS.find((r) => r.role === selected);
  return (
    <AdminPage title="Roadmaps" crumbs={[{ label: "Roadmaps" }]} sub="The actual role-based learning paths shown to candidates." live>
      <div className="mb-4 flex flex-wrap gap-2">{ROLE_ROADMAPS.map((r) => <button key={r.role} onClick={() => setSelected(r.role)} className={cn("rounded-lg border px-3 py-1.5 text-sm", r.role === selected ? "border-primary/30 bg-primary/10 font-medium text-primary" : "bg-card hover:bg-muted")}>{r.role}</button>)}</div>
      {roadmap && <Panel title={roadmap.role} sub={`${roadmap.phases.length} phases`}><Accordion type="single" collapsible className="px-5">
        {roadmap.phases.map((phase, i) => <AccordionItem key={phase.id} value={phase.id}>
          <AccordionTrigger className="text-sm"><span className="flex items-center gap-3"><span className="text-xs text-muted-foreground tabular-nums">Phase {i + 1}</span>{phase.title}</span></AccordionTrigger>
          <AccordionContent><p className="text-sm text-muted-foreground">{phase.description}</p><ul className="mt-3 space-y-2">{phase.activities.map((id) => { const a = ACTIVITIES[id]; return a ? <li key={id} className="rounded-lg border bg-surface p-3 text-sm"><span className="font-medium">{a.title}</span><span className="block text-xs text-muted-foreground">{a.hours}h · {a.difficulty}</span></li> : null; })}</ul></AccordionContent>
        </AccordionItem>)}
      </Accordion></Panel>}
    </AdminPage>
  );
}
