import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Compass,
  FileText,
  KanbanSquare,
  LayoutGrid,
  Map,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { Logo, Lifecycle } from "@/components/brand";
import { auth } from "@/services/backend";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerOS — Organize your job search and career growth" },
      {
        name: "description",
        content:
          "Find roles from company job boards, compare your skills with what they ask for, follow a learning roadmap, prepare resumes and interviews, and track applications in one workspace.",
      },
      { property: "og:title", content: "CareerOS — Your career, intelligently organized" },
      {
        property: "og:description",
        content: "One workspace for opportunities, skill gaps, roadmaps, resumes, interview prep and application tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NAV = [
  { href: "#preview", label: "Workspace" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
];

const STEPS = [
  { t: "Discover roles", d: "Browse openings from companies' public job boards and follow the companies you care about." },
  { t: "Check your skill gaps", d: "Rate your current skills and compare them with what a role asks for." },
  { t: "Prepare with a roadmap", d: "Pick a target role, follow ordered topics, log study time and use the learning hub." },
  { t: "Apply and track", d: "Apply on the company's own careers site, then record each stage in your tracker." },
];

type Feature = { icon: LucideIcon; t: string; d: string; tint: string };
const FEATURES: Feature[] = [
  { icon: Compass, t: "Opportunity discovery", d: "Search and filter real listings, save roles and open the official application page.", tint: "bg-tint-blue text-tint-blue-ink" },
  { icon: Target, t: "Skill-gap insights", d: "See which skills you already have and which ones a role still needs.", tint: "bg-tint-violet text-tint-violet-ink" },
  { icon: Map, t: "Career roadmaps", d: "Structured paths for common roles with progress you update as you learn.", tint: "bg-tint-green text-tint-green-ink" },
  { icon: FileText, t: "Resume builder", d: "Write and edit your resume, preview it live and export it as a PDF.", tint: "bg-tint-orange text-tint-orange-ink" },
  { icon: MessagesSquare, t: "Interview preparation", d: "Practise technical, HR, role and company questions with written feedback.", tint: "bg-tint-blue text-tint-blue-ink" },
  { icon: KanbanSquare, t: "Application tracking", d: "Keep every application, stage and upcoming date in one organized view.", tint: "bg-tint-violet text-tint-violet-ink" },
];

const PRINCIPLES = [
  { icon: ExternalLink, t: "You apply at the source", d: "CareerOS links to each company's official careers page instead of re-posting listings." },
  { icon: Sparkles, t: "AI that stays grounded", d: "Suggestions only use what you've entered, never invent experience, and stay editable." },
  { icon: ShieldCheck, t: "Your workspace is private", d: "Saved roles, progress, resumes and applications are visible only to your account." },
];

const PREVIEW_NAV: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutGrid, label: "Overview" },
  { icon: Compass, label: "Opportunities" },
  { icon: Target, label: "Skill gaps" },
  { icon: Map, label: "Roadmap" },
  { icon: KanbanSquare, label: "Applications" },
  { icon: Building2, label: "Companies" },
  { icon: BookOpen, label: "Learning hub" },
  { icon: FileText, label: "Resume" },
  { icon: MessagesSquare, label: "Interview prep" },
  { icon: CalendarDays, label: "Calendar" },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    auth.hasSession().then(setSignedIn).catch(() => setSignedIn(false));
  }, []);
  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "Open workspace" : "Get started";

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Logo />
          <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            {!signedIn && (
              <Link to="/auth" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Sign in
              </Link>
            )}
            <Link to={cta} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {signedIn ? "Open workspace" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 text-center sm:px-6 sm:pt-20">
          <p className="eyebrow animate-rise">Your career, intelligently organized</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem] animate-rise [animation-delay:80ms]">
            Organize your job search and <span className="text-gradient">grow with a clear plan.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground animate-rise [animation-delay:160ms]">
            CareerOS brings opportunities, skill gaps, learning roadmaps, resumes, interview practice and application tracking into one workspace — so you always know your next step.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center animate-rise [animation-delay:240ms]">
            <Link to={cta} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {ctaLabel} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a href="#features" className="inline-flex h-11 items-center justify-center rounded-lg border bg-card px-6 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Explore features
            </a>
          </div>
        </section>

        <section id="preview" aria-labelledby="preview-title" className="scroll-mt-20 px-5 pb-20 sm:px-6">
          <h2 id="preview-title" className="sr-only">Workspace preview</h2>
          <div className="relative mx-auto max-w-5xl animate-rise [animation-delay:320ms]">
            <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 bg-glow" aria-hidden />
            <WorkspacePreview />
            <p className="relative mt-4 text-center text-xs text-muted-foreground">
              Layout preview with no sample data. Your own roles, skills and applications appear after you sign in.
            </p>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-y bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2 id="how-title" className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                From first search to a tracked application.
              </h2>
            </div>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="rounded-xl border bg-card p-6">
                  <span className="grid size-8 place-items-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="eyebrow">Features</p>
            <h2 id="features-title" className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Everything for your search, in one connected workspace.
            </h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="bg-card p-6">
                <span className={cn("grid size-9 place-items-center rounded-lg", f.tint)}>
                  <f.icon className="size-[18px]" aria-hidden />
                </span>
                <h3 className="mt-5 text-base font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Also included: company following with notifications, a learning hub, a calendar for deadlines and interviews, and progress analytics.
          </p>
        </section>

        <section aria-labelledby="principles-title" className="border-t bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-6 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow">Our approach</p>
              <h2 id="principles-title" className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                Clear about what it does.
              </h2>
            </div>
            <ul className="grid gap-6 sm:grid-cols-3">
              {PRINCIPLES.map((p) => (
                <li key={p.t}>
                  <p.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-4 text-sm font-semibold">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <div className="rounded-2xl bg-ink px-6 py-14 text-center text-ink-foreground sm:px-10">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">Set your goal and see your next step.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm opacity-75">
              Create an account, choose a target role and start organizing your search.
            </p>
            <Link to={cta} className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
              {ctaLabel} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <span className="text-xs">© 2026 CareerOS</span>
        </div>
      </footer>
    </div>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <span className={cn("block h-2 rounded-full bg-muted", className)} aria-hidden />;
}

const PREVIEW_TILES: { icon: LucideIcon; t: string; d: string; span?: string }[] = [
  { icon: Compass, t: "Opportunities", d: "Saved and recommended roles", span: "sm:col-span-2" },
  { icon: Target, t: "Skill gaps", d: "Your levels vs. role needs" },
  { icon: Map, t: "Roadmap", d: "Next topic and study time" },
  { icon: KanbanSquare, t: "Applications", d: "Saved · Applied · Interview · Offer", span: "sm:col-span-2" },
  { icon: FileText, t: "Resume", d: "Draft and export", span: "hidden sm:block" },
  { icon: MessagesSquare, t: "Interview prep", d: "Practice sessions", span: "hidden sm:block" },
];

function WorkspacePreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card text-left shadow-float" aria-label="Illustration of the CareerOS workspace layout" role="img">
      <div className="flex items-center gap-2 border-b bg-surface px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">careeros / overview</span>
      </div>
      <div className="flex">
        <aside className="hidden w-48 shrink-0 border-r bg-sidebar p-3 md:block">
          <ul className="space-y-0.5">
            {PREVIEW_NAV.map((n, i) => (
              <li
                key={n.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]",
                  i === 0 ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80",
                )}
              >
                <n.icon className="size-3.5" aria-hidden />
                {n.label}
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Overview</p>
              <p className="mt-1.5 font-display text-lg font-bold">Your career journey</p>
            </div>
            <SkeletonLine className="w-28" />
          </div>
          <div className="mt-4 hidden overflow-hidden rounded-lg border bg-surface px-3 py-2.5 sm:block">
            <Lifecycle active={0} compact />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {PREVIEW_TILES.map((tile) => (
              <div key={tile.t} className={cn("rounded-xl border p-4", tile.span)}>
                <div className="flex items-center gap-2">
                  <tile.icon className="size-4 text-primary" aria-hidden />
                  <p className="text-sm font-semibold">{tile.t}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tile.d}</p>
                <div className="mt-4 space-y-2">
                  <SkeletonLine className="w-4/5" />
                  <SkeletonLine className="w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
