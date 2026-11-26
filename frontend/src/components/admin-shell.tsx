import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LayoutGrid, Briefcase, Building2, Radio, Users, Layers, Map, Bell, BarChart3, Settings, LogOut, Search, PanelLeftClose, PanelLeftOpen, ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { useQuery } from "@tanstack/react-query";
import { profileQuery } from "@/lib/user-data";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const GROUPS = [
  { label: "Main", items: [{ to: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true }] },
  { label: "Job ecosystem", items: [
    { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
    { to: "/admin/companies", label: "Companies", icon: Building2 },
    { to: "/admin/sources", label: "Job Sources", icon: Radio },
  ] },
  { label: "Users & career", items: [
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/roles", label: "Roles & Skills", icon: Layers },
    { to: "/admin/roadmaps", label: "Roadmaps", icon: Map },
  ] },
  { label: "Engagement", items: [
    { to: "/admin/notifications", label: "Notifications", icon: Bell },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { label: "System", items: [{ to: "/admin/settings", label: "Settings", icon: Settings }] },
] as const;

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="mt-6 space-y-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          {!collapsed && <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</p>}
          <div className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, ...rest }) => (
              <Tooltip key={to}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    onClick={onNavigate}
                    activeOptions={{ exact: "exact" in rest }}
                    className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent", collapsed && "justify-center")}
                    activeProps={{ className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground" }}
                  >
                    <Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.75} />
                    {!collapsed && label}
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  hidden={!collapsed}
                  className="border border-border bg-popover text-popover-foreground shadow-soft"
                >
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AdminMenu({ signOut, compact }: { signOut: () => void; compact?: boolean }) {
  const { data: profile } = useQuery(profileQuery);
  const email = profile?.email ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Open admin menu" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-8"><AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">A</AvatarFallback></Avatar>
          {!compact && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Platform Admin</p>
                <p className="truncate text-xs text-muted-foreground">Super admin</p>
              </div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">Platform Admin</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/admin/settings">Admin settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="gap-2 text-destructive focus:text-destructive"><LogOut className="size-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminShell({ children, signOut }: { children: ReactNode; signOut: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r bg-sidebar px-3 py-5 transition-[width] md:flex", collapsed ? "w-16" : "w-60")}>
        <div className={cn("flex items-center px-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <div className="flex items-center gap-2"><Logo to="/admin" /><span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Admin</span></div>}
          <Tooltip>
            <TooltipTrigger asChild>
              <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent">
                {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="border border-border bg-popover text-popover-foreground shadow-soft">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
        <Nav collapsed={collapsed} />
        <div className="mt-auto border-t pt-4"><AdminMenu signOut={signOut} compact={collapsed} /></div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-4">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <Logo to="/admin" />
          <Nav collapsed={false} onNavigate={() => setOpen(false)} />
          <div className="mt-6 border-t pt-4"><AdminMenu signOut={signOut} /></div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-5 py-3 backdrop-blur-md md:px-8">
          <button aria-label="Open navigation" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-muted md:hidden"><Menu className="size-5" /></button>
          <Link to="/admin/jobs" className="flex flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Search className="size-4" /> <span className="truncate">Search jobs, companies, sources…</span>
          </Link>
          <Link to="/admin/notifications" aria-label="Notifications" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="size-4" /></Link>
        </header>
        <main key={pathname} className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
    </TooltipProvider>
  );
}
