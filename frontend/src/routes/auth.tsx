import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { auth, USE_API } from "@/services/backend";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { AuthJourney } from "@/components/auth-journey";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CareerOS" },
      { name: "description", content: "Sign in or create your CareerOS workspace." },
      { property: "og:title", content: "Sign in — CareerOS" },
      { property: "og:description", content: "Sign in or create your CareerOS workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const go = async () => {
      const u = await auth.getUser();
      if (u) navigate({ to: u.role === "admin" ? "/admin" : "/dashboard", replace: true });
    };
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    if (USE_API && oauthError) toast.error("Google sign-in didn't complete. Please try again.");
    if (USE_API && code) {
      window.history.replaceState(null, "", "/auth");
      auth.completeGoogle(code).then(go, () => toast.error("Google sign-in expired. Please try again."));
    } else go();
    return auth.onChange((signedIn) => { if (signedIn) go(); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        await auth.signIn(email, password);
      } else if (mode === "up") {
        const confirm = await auth.signUp(name, email, password);
        if (confirm) toast.success("Check your email to confirm your account.");
      } else {
        await auth.requestPasswordReset(email);
        toast.success("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    try { await auth.google(); } catch (e) { toast.error((e as Error).message); }
  }

  const input = "auth-input";

  return (
    <div className="auth-page">
      <header className="auth-header"><Logo /><Button asChild variant="ghost" className="text-muted-foreground"><Link to="/"><ArrowLeft />Back to home</Link></Button></header>
      <main className="auth-layout">
        <AuthJourney />
        <section className="auth-form-panel" aria-labelledby="auth-heading">
          <h2 id="auth-heading" className="text-[28px] font-bold leading-tight">
            {mode === "in" ? "Sign in to CareerOS" : mode === "up" ? "Create your workspace" : "Reset password"}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {mode === "forgot" ? "We'll email you a reset link." : mode === "up" ? "Your next chapter starts here." : "Pick up where you left off."}
          </p>

          {mode !== "forgot" && (
            <>
              <Button onClick={google} variant="outline" className="auth-google mt-8 h-12 w-full rounded-xl gap-3">
                <svg viewBox="0 0 24 24" className="google-mark" aria-hidden="true"><path className="google-blue" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z"/><path className="google-green" d="M12 22c2.7 0 5-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path className="google-yellow" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.5H3a10 10 0 0 0 0 9l3.4-2.7Z"/><path className="google-red" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.7C7.2 7.9 9.4 6.1 12 6.1Z"/></svg>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4 mt-5">
            {mode === "up" && <div><label htmlFor="auth-name" className="auth-label">Full name</label><input id="auth-name" className={input} autoComplete="name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
            <div><label htmlFor="auth-email" className="auth-label">Email address</label><div className="auth-input-wrap"><Mail /><input id="auth-email" className={input} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></div>
            {mode !== "forgot" && (
              <div><label htmlFor="auth-password" className="auth-label">Password</label><div className="auth-input-wrap"><LockKeyhole /><input id="auth-password" className={input} type={showPassword ? "text" : "password"} autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder="Enter your password" minLength={mode === "up" ? 8 : 6} value={password} onChange={(e) => setPassword(e.target.value)} required /><Button type="button" variant="ghost" size="icon" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
            )}
            {mode === "in" && <div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0" onClick={() => setMode("forgot")}>Forgot password?</Button></div>}
            <Button disabled={busy} className="auth-submit h-12 w-full rounded-xl text-base" type="submit">
              {busy ? "One moment…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
              {!busy && <ArrowRight />}
            </Button>
          </form>

          <div className="mt-7 border-t pt-5 text-center text-sm text-muted-foreground">
            {mode === "in" ? (
              <>
                 New to CareerOS? <Button onClick={() => setMode("up")} variant="link" className="h-auto p-0">Create an account</Button>
              </>
            ) : (
              <Button onClick={() => setMode("in")} variant="link" className="h-auto p-0">Back to sign in</Button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
