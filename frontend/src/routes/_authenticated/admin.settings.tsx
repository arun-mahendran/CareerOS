import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, Panel, btnPrimary } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — CareerOS Admin" }, { name: "description", content: "Platform configuration." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Settings — CareerOS Admin" }, { property: "og:description", content: "Platform configuration." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SettingsPage,
});

const SECTIONS = {
  platform: { label: "Platform", fields: [["Platform name", "CareerOS"], ["Support email", "support@careeros.app"]], toggles: ["Allow new candidate sign-ups", "Maintenance mode"] },
  email: { label: "Email", fields: [["Sender name", "CareerOS"], ["Sender address", "alerts@careeros.app"]], toggles: ["Send daily digest"] },
  google: { label: "Google", fields: [["OAuth client ID", ""]], toggles: ["Google sign-in", "Google Calendar sync"] },
  payments: { label: "Payments", fields: [["Currency", "INR"]], toggles: ["Enable Premium plan"] },
  notifications: { label: "Notifications", fields: [["Max emails per user / day", "5"]], toggles: ["New company job alerts", "Interview reminders", "Roadmap reminders"] },
} as const;

function SettingsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ "Allow new candidate sign-ups": true, "Google sign-in": true, "New company job alerts": true, "Interview reminders": true });
  return (
    <AdminPage title="Settings" crumbs={[{ label: "Settings" }]} sub="Essential platform configuration. Secret keys are stored on the server, never here.">
      <Tabs defaultValue="platform">
        <TabsList>{Object.entries(SECTIONS).map(([k, s]) => <TabsTrigger key={k} value={k}>{s.label}</TabsTrigger>)}</TabsList>
        {Object.entries(SECTIONS).map(([k, s]) => (
          <TabsContent key={k} value={k} className="mt-4">
            <Panel title={`${s.label} settings`} right={<button className={btnPrimary} onClick={() => toast.success(`${s.label} settings saved`)}>Save</button>}>
              <div className="divide-y">
                {s.fields.map(([l, v]) => (
                  <label key={l} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                    <span>{l}</span>
                    <input defaultValue={v} placeholder="Not configured" className="w-72 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                ))}
                {s.toggles.map((t) => (
                  <div key={t} className="flex items-center justify-between px-5 py-4 text-sm">
                    <span>{t}</span>
                    <Switch aria-label={t} checked={!!on[t]} onCheckedChange={(v) => setOn({ ...on, [t]: v })} />
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>
        ))}
      </Tabs>
    </AdminPage>
  );
}
