import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Premium — CareerOS" }, { name: "description", content: "Compare CareerOS plans." }, { property: "og:title", content: "Premium — CareerOS" }, { property: "og:description", content: "Compare CareerOS plans." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Premium,
});

const PLANS = [
  { name: "Free", tag: "Current plan", features: ["Job discovery & saving", "Skill gap analysis", "Learning roadmap", "Application tracker"] },
  { name: "Premium", tag: "Coming soon", features: ["Everything in Free", "AI resume tailoring", "AI mock interview feedback", "Unlimited resume versions", "Priority job alerts"] },
];

function Premium() {
  return (
    <>
      <PageHeader eyebrow="Plans" title="Go further with Premium" sub="Premium isn't on sale yet — pricing will be announced." />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        {PLANS.map((p, i) => (
          <div key={p.name} className={`rounded-2xl border p-7 shadow-soft ${i ? "bg-gradient-accent text-primary-foreground" : "bg-card"}`}>
            <p className={`text-xs ${i ? "opacity-80" : "text-muted-foreground"}`}>{p.tag}</p>
            <p className="mt-1 font-display text-2xl font-bold">{p.name}</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {p.features.map((f) => <li key={f} className="flex items-center gap-2"><Check className="size-4 opacity-80" />{f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
