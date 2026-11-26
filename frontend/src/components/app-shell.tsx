import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutGrid,
  Compass,
  Target,
  Map,
  KanbanSquare,
  Building2,
  BookOpen,
  FileText,
  MessagesSquare,
  CalendarDays,
  BarChart3,
  Settings,
  Sparkles,
  LogOut,
  Search,
  Bell,
  UserRound,
  ChevronDown,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { auth } from "@/services/backend";
import { profileQuery } from "@/lib/user-data";
import { useUnreadNotifications } from "@/lib/notifications";
import { hasUnreadNotifications } from "@/lib/notification-state";
import { useSessionLogout } from "@/components/session-timeout";
import { AdminShell } from "@/components/admin-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/jobs", label: "Opportunities", icon: Compass },
  { to: "/skills", label: "Skill gaps", icon: Target },
  { to: "/roadmap", label: "Roadmap", icon: Map },
  { to: "/applications", label: "Applications", icon: KanbanSquare },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/learning", label: "Learning hub", icon: BookOpen },
  { to: "/resumes", label: "Resume", icon: FileText },
  { to: "/interviews", label: "Interview prep", icon: MessagesSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/premium", label: "Premium", icon: Sparkles },
] as const;

const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Admin home", icon: ShieldCheck },
  { to: "/jobs", label: "Job catalog", icon: Compass },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/learning", label: "Resources", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const signOut = useSessionLogout();
  const { data: profile } = useQuery(profileQuery);

  const unread = useUnreadNotifications();
  const showUnread = hasUnreadNotifications(unread.data?.count, unread.isError);

  const admin = profile?.role === "admin";

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = admin ? ADMIN_NAV_ITEMS : NAV;
  const name = admin ? "Admin" : profile?.full_name || profile?.email?.split("@")[0] || "";
  const initials = name.slice(0, 1).toUpperCase() || "?";

  if (admin) return <AdminShell signOut={() => void signOut()}>{children}</AdminShell>;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen bg-background">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar px-3 py-5 transition-[width] md:flex ${collapsed ? "w-16" : "w-60"}`}
      >
        <div
          className={`flex items-center px-2 ${collapsed ? "justify-center" : "justify-between"}`}
        >
          {!collapsed && <Logo to="/dashboard" />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent"
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="border border-border bg-popover text-popover-foreground shadow-soft"
            >
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
        <nav className="mt-8 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent ${collapsed ? "justify-center" : ""}`}
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
        </nav>
        <div className="mt-auto border-t pt-4">
          <ProfileMenu name={name} initials={initials} signOut={signOut} collapsed={collapsed} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b px-5 py-3 md:hidden">
          <Logo to="/dashboard" />
          <ProfileMenu name={name} initials={initials} signOut={signOut} compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
          {nav.map(({ to, label }) => (
            <Link key={to} to={to} className="shrink-0 rounded-md px-3 py-1.5 text-xs" activeProps={{ className: "bg-accent text-accent-foreground" }}>
              {label}
            </Link>
          ))}
        </nav>
        <header className="sticky top-0 z-20 hidden items-center gap-4 border-b bg-background/80 px-10 py-3 backdrop-blur-md md:flex">
          <Link to="/jobs" className="flex flex-1 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Search className="size-4" /> Search jobs, companies, skills or learning resources…
          </Link>
          <Link to="/notifications" aria-label={showUnread ? `Notifications, ${unread.data?.count} unread` : "Notifications"} onClick={() => { if (unread.isEnabled) void unread.refetch(); }} className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Bell className="size-4" />
            {showUnread && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />}
          </Link>
          <ProfileMenu name={name} initials={initials} signOut={signOut} compact />
        </header>
        <main key={pathname} className="mx-auto max-w-6xl px-5 py-8 animate-rise md:px-10 md:py-10">{children}</main>
      </div>
    </div>
    </TooltipProvider>
  );
}

function ProfileMenu({
  name,
  initials,
  signOut,
  compact = false,
  collapsed = false,
}: {
  name: string;
  initials: string;
  signOut: () => void;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Open profile menu"
              className={
                compact
                  ? "flex items-center gap-2 rounded-full border border-border bg-surface p-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  : `group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${collapsed ? "justify-center" : ""}`
              }
            >
              <Avatar className={compact ? "size-8" : "size-9"}>
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name || "Profile"} />}
                <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!compact && !collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile?.target_role}</p>
                </div>
              )}
              {!collapsed && (
                <ChevronDown
                  className={
                    compact
                      ? "size-3.5 text-muted-foreground"
                      : "size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  }
                />
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          hidden={!collapsed}
          className="border border-border bg-popover text-popover-foreground shadow-soft"
        >
          {name}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name || "Profile"} />}
              <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            navigate({ to: "/profile" });
          }}
          className="gap-2"
        >
          <UserRound className="size-4 opacity-70" /> My profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void (async () => {
              await signOut();
            })();
          }}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-4 opacity-70" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
