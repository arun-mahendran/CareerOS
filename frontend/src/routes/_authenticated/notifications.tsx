import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsQuery, useUnreadNotifications } from "@/lib/notifications";
import { notifications, USE_API } from "@/services/backend";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CareerOS" }, { name: "description", content: "Updates on jobs, your roadmap and applications." }, { property: "og:title", content: "Notifications — CareerOS" }, { property: "og:description", content: "Updates on jobs, your roadmap and applications." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Notifications,
});

function Notifications() {
  const qc = useQueryClient();
  const query = useQuery(notificationsQuery);
  const unread = useUnreadNotifications();
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: notifications.read, onSuccess: refresh, onError: () => toast.error("Couldn't mark that notification as read. Try again.") });
  const readAll = useMutation({ mutationFn: notifications.readAll, onSuccess: refresh, onError: () => toast.error("Couldn't mark notifications as read. Try again.") });
  const items = query.data ?? [];

  return (
    <>
      <PageHeader eyebrow="Notifications" title="What's new" right={USE_API && <Button variant="outline" size="sm" disabled={!unread.data?.count || readAll.isPending} onClick={() => readAll.mutate()}><CheckCheck className="size-4" /> Mark all as read</Button>} />
      <div className="divide-y rounded-2xl border bg-card shadow-soft">
        {!USE_API ? <p className="px-6 py-8 text-sm text-muted-foreground">Notifications aren't available until your career server is connected.</p>
          : query.isPending ? <Skeleton className="m-6 h-24" aria-label="Loading notifications" />
          : query.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 px-6 py-8 text-sm text-destructive">Couldn't load notifications.<Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div>
          : items.length === 0 ? <p className="px-6 py-8 text-sm text-muted-foreground">No notifications yet.</p>
          : items.map((n) => (
          <div key={n.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground"><Bell className="size-4" /></span>
            <div className="min-w-0 flex-1 break-words">
              <p className="text-xs text-muted-foreground">{n.type.replaceAll("_", " ")}{!n.read_at && " · Unread"}</p>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              {n.link && n.link.startsWith("/") && !n.link.startsWith("//") && <a href={n.link} className="text-xs text-primary underline">View update</a>}
            </div>
            {!n.read_at && <Button variant="ghost" size="icon" aria-label={`Mark ${n.title} as read`} title="Mark as read" disabled={read.isPending || readAll.isPending} onClick={() => read.mutate(n.id)}><Check className="size-4" /></Button>}
          </div>
        ))}
      </div>
    </>
  );
}
