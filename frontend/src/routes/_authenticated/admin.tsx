import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// The role comes from the backend (role table / signed session), never from browser storage.
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if ((context as { user?: { role?: string } }).user?.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — CareerOS" }, { name: "description", content: "CareerOS platform administration." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Admin — CareerOS" }, { property: "og:description", content: "CareerOS platform administration." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <Outlet />,
});
