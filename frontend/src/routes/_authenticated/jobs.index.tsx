import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { USE_API } from "@/services/backend";
import { LiveOpportunities } from "@/components/live-opportunities";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({ meta: [{ title: "Opportunities — CareerOS" }, { name: "description", content: "Real roles from official company job boards." }, { property: "og:title", content: "Opportunities — CareerOS" }, { property: "og:description", content: "Real roles from official company job boards." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Jobs,
});

function Jobs() {
  if (!USE_API) return (
    <>
      <PageHeader eyebrow="Discover" title="Opportunities" sub="Real roles from official company job boards." />
      <div className="rounded-xl border bg-card p-10 text-center shadow-soft">
        <p className="font-medium">No job source is connected</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Set VITE_API_URL to your CareerOS FastAPI server. An admin can then add official Greenhouse, Lever or Ashby boards and sync real openings.</p>
      </div>
    </>
  );
  return <LiveOpportunities />;
}
