import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/services/backend";
import { AppShell } from "@/components/app-shell";
import { SessionTimeout } from "@/components/session-timeout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return <SessionTimeout key={user.id} userId={user.id}><AppShell><Outlet /></AppShell></SessionTimeout>;
}
