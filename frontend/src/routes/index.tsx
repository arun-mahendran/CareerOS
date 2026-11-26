import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo, Lifecycle, MatchRing } from "@/components/brand";
import { auth } from "@/services/backend";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerOS — Stop searching for jobs. Start building your career." },
      { name: "description", content: "Discover relevant roles, understand your skill gaps, follow a learning roadmap and track every application in one workspace." },
      { property: "og:title", content: "CareerOS — Your career, intelligently organized" },
      { property: "og:description", content: "One connected workspace for discovery, skill gaps, roadmaps, interviews and applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { n: "01", t: "Discover", d: "Roles curated to your goal, not an endless feed." },
  { n: "02", t: "Understand your fit", d: "A clear match score with the reasons behind it." },
  { n: "03", t: "Close the gaps", d: "See exactly which skills stand between you and the offer." },
  { n: "04", t: "Follow a roadmap", d: "Ordered steps, realistic hours, visible progress." },
  { n: "05", t: "Apply & track", d: "Apply on the official portal. Track every stage here." },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    auth.hasSession().then(setSignedIn);
  }, []);
  const cta = signedIn ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          {!signedIn && (
            <Link to="/auth" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
          <Link to={cta} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ink-foreground">
            {signedIn ? "Open workspace" : "Get Started"}
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <p className="eyebrow animate-rise">Your career, intelligently organized</p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl animate-rise [animation-delay:80ms]">
          Stop searching for jobs.
          <br />
          <span className="text-gradient">Start building your career.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground animate-rise [animation-delay:160ms]">
          Discover relevant opportunities, understand your skill gaps, build targeted roadmaps, and prepare for interviews — all from one career workspace.
        </p>
        <div className="mt-8 flex justify-center gap-3 animate-rise [animation-delay:240ms]">
          <Link to={cta} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft">
            Get Started
          </Link>
          <a href="#how" className="rounded-lg border bg-card px-5 py-2.5 text-sm font-medium">
            Explore CareerOS
          </a>
        </div>

        <div className="relative mx-auto mt-20 max-w-4xl animate-rise [animation-delay:320ms]">
          <div className="absolute -inset-16 bg-glow" aria-hidden />
          <HeroPreview />
        </div>
      </section>

      <section id="how" className="border-t bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="eyebrow">How CareerOS works</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold">One connected path from first search to signed offer.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-card p-6">
                <span className="font-mono text-xs text-primary">{s.n}</span>
                <h3 className="mt-6 text-base font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="eyebrow">Not a job board</p>
            <h2 className="mt-3 text-3xl font-bold">Every role comes with a plan.</h2>
            <p className="mt-4 text-muted-foreground">
              Open any opportunity and see what you already have, what's missing, and the shortest route to being ready. Then apply on the company's official portal — CareerOS keeps track.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            {[
              ["React", 82, 80],
              ["TypeScript", 70, 80],
              ["Testing", 35, 70],
              ["Accessibility", 30, 65],
            ].map(([n, l, r]) => (
              <div key={n as string} className="py-3">
                <div className="flex justify-between text-sm">
                  <span>{n}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {l} / {r}
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${l}%` }} />
                  <div className="absolute top-[-3px] h-3 w-0.5 bg-foreground" style={{ left: `${r}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl bg-ink px-8 py-16 text-center text-ink-foreground">
          <h2 className="text-3xl font-bold">Your next role has a roadmap.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm opacity-70">Set a goal in a minute. We'll organize the rest.</p>
          <Link to={cta} className="mt-8 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Get Started
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <Logo />
          <span>© 2026 CareerOS</span>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative rounded-2xl border bg-card p-5 text-left shadow-float">
      <div className="flex items-center justify-between border-b pb-4">
        <Lifecycle active={3} compact />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="eyebrow">Career readiness</p>
          <p className="mt-3 font-display text-3xl font-bold">72<span className="text-base text-muted-foreground">%</span></p>
          <div className="mt-3 h-1.5 rounded-full bg-muted">
            <div className="h-full w-[72%] rounded-full bg-gradient-accent" />
          </div>
        </div>
        <div className="rounded-xl border p-4 md:col-span-2">
          <p className="eyebrow">Recommended roles</p>
          <div className="mt-3 space-y-3">
            {[
              ["Frontend Engineer", "Stripe", 86],
              ["Product Engineer", "Notion", 78],
            ].map(([t, c, m]) => (
              <div key={t as string} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground">{c}</p>
                </div>
                <MatchRing value={m as number} size={36} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-4 md:col-span-2">
          <p className="eyebrow">Application pipeline</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[["Saved", 6], ["Applied", 4], ["Interview", 2], ["Offer", 1]].map(([l, n]) => (
              <div key={l as string} className="rounded-lg bg-surface py-3">
                <p className="font-display text-lg font-bold">{n}</p>
                <p className="text-[11px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-4 animate-float">
          <p className="eyebrow">Next step</p>
          <p className="mt-3 text-sm font-medium">Component testing</p>
          <p className="text-xs text-muted-foreground">8 hrs · closes Testing gap</p>
        </div>
      </div>
    </div>
  );
}
