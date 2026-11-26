import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { USE_API } from "@/services/backend";
import { LiveJobDetail } from "@/components/live-job-detail";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  loader: ({ params }) => {
    if (!USE_API) throw notFound();
    return { liveId: params.jobId };
  },
  head: () => ({ meta: [{ title: "Role — CareerOS" }, { name: "description", content: "Explore this employer-published role and apply on the official portal." }, { property: "og:title", content: "Role — CareerOS" }, { property: "og:description", content: "Explore this employer-published role and apply on the official portal." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  notFoundComponent: () => <p className="text-sm text-muted-foreground">This role is unavailable without the live CareerOS server. <Link to="/jobs" className="text-primary">Browse roles</Link></p>,
  errorComponent: () => <p className="text-sm">Couldn't load this role.</p>,
  component: JobDetail,
});

function JobDetail() {
  const { liveId } = Route.useLoaderData();
  return <LiveJobDetail id={liveId} />;
}
