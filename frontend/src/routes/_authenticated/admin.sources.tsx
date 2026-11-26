import { createFileRoute } from "@tanstack/react-router";
import { USE_API } from "@/services/backend";
import { LiveSources } from "@/components/admin/live-sources";
import { BackendRequired } from "@/components/admin/backend-required";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  head: () => ({ meta: [{ title: "Job sources — CareerOS Admin" }, { name: "description", content: "Monitor and control real job sources." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Job sources — CareerOS Admin" }, { property: "og:description", content: "Monitor and control real job sources." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Sources,
});

function Sources() {
  return USE_API ? <LiveSources /> : <BackendRequired title="Job Sources" sub="Official company boards CareerOS monitors for new roles." crumbs={[{ label: "Job Sources" }]} />;
}
