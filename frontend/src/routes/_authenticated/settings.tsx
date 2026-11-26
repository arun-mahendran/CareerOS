import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/app-shell";
import { profileQuery } from "@/lib/user-data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CareerOS" }, { name: "description", content: "Appearance, notifications and connected accounts." }, { property: "og:title", content: "Settings — CareerOS" }, { property: "og:description", content: "Appearance, notifications and connected accounts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Settings,
});

function Settings() {
  const { data: profile } = useQuery(profileQuery);
  const { theme, setTheme } = useTheme();
  const google = Boolean(profile?.avatar_url);

  return (
    <>
      <PageHeader eyebrow="Settings" title="Preferences" />
      <div className="max-w-2xl space-y-4">
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <p className="eyebrow">Appearance</p>
          <div className="mt-4 flex items-center justify-between text-sm"><span>Dark mode</span><Switch aria-label="Dark mode" checked={theme === "dark"} onCheckedChange={(dark) => setTheme(dark ? "dark" : "light")} /></div>
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <p className="eyebrow">Connected accounts</p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span>Google</span>
            <span className={google ? "text-success" : "text-muted-foreground"}>{google ? "Connected" : "Not connected"}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm"><span>Google Calendar</span><span className="text-muted-foreground">Not available yet</span></div>
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <p className="eyebrow">Account</p>
          <div className="mt-4 flex items-center justify-between text-sm"><span>{profile?.email}</span><Link to="/profile" className="text-primary hover:underline">Edit profile</Link></div>
        </section>
      </div>
    </>
  );
}
