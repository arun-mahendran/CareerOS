import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auth, USE_API } from "@/services/backend";
import { SESSION_ENDED_EVENT } from "@/services/api";
import { IdleSession } from "@/lib/idle-session";
import { SESSION_CONFIG } from "@/lib/session-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Context = createContext<(() => Promise<void>) | null>(null);
export function useSessionLogout() {
  const logout = useContext(Context);
  if (!logout) throw new Error("Session controls require the authenticated layout");
  return logout;
}

export function SessionTimeout({ userId, children }: { userId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [warning, setWarning] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [ending, setEnding] = useState(false);
  const endingRef = useRef(false);
  const warningRef = useRef(false);
  const idle = useRef<IdleSession | null>(null);
  const recordActivity = useRef<() => void>(() => {});
  const activityKey = `careeros.activity.${userId}`;
  const logoutKey = `careeros.logout.${userId}`;
  const storageRead = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
  const storageWrite = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* timer still works without storage */ } };

  async function logout(expired = false, revoke = true) {
    if (endingRef.current) return;
    endingRef.current = true;
    idle.current?.stop();
    setEnding(true);
    setWarning(false);
    storageWrite(logoutKey, String(Date.now()));
    void qc.cancelQueries();
    qc.clear();
    try {
      if (revoke) await auth.signOut();
      else auth.invalidate();
    } finally {
      qc.clear();
      if (expired) toast.info("You were signed out due to inactivity.");
      await navigate({ to: "/auth", replace: true });
    }
  }
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    const now = Date.now();
    const stored = Number(storageRead(activityKey));
    const loggedOut = Number(storageRead(logoutKey));
    const start = stored > loggedOut && stored <= now ? stored : now;
    storageWrite(activityKey, String(start));
    let lastWrite = start;
    const controller = new IdleSession(start, SESSION_CONFIG.timeoutMs, SESSION_CONFIG.warningMs,
      () => { warningRef.current = true; setWarning(true); },
      () => { void logoutRef.current(true); });
    idle.current = controller;
    const activity = () => {
      if (endingRef.current || warningRef.current || document.visibilityState === "hidden") return;
      const at = Date.now();
      if (at - lastWrite < SESSION_CONFIG.activityThrottleMs) return;
      controller.check();
      if (endingRef.current || warningRef.current) return;
      lastWrite = at;
      storageWrite(activityKey, String(at));
      controller.activity(at);
    };
    recordActivity.current = activity;
    const sync = (event: StorageEvent) => {
      if (event.key === activityKey && event.newValue) {
        const at = Number(event.newValue);
        if (Number.isFinite(at) && at <= Date.now() && at > lastWrite) {
          if (endingRef.current) return;
          lastWrite = at;
          warningRef.current = false;
          setWarning(false);
          controller.activity(at);
        }
      }
      if (event.key === logoutKey || (USE_API && event.key === "careeros.refresh" && event.newValue === null)) {
        void logoutRef.current(false);
      }
    };
    const check = () => controller.check();
    const ended = () => { void logoutRef.current(false, false); };
    const unsubscribe = auth.onChange((signedIn) => { if (!signedIn) ended(); });
    const events = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", check);
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.stop();
      idle.current = null;
      unsubscribe();
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", check);
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId]);

  useEffect(() => { recordActivity.current(); }, [pathname]);

  async function continueSession() {
    setRenewing(true);
    try {
      await auth.validateSession();
      if (endingRef.current) return;
      const at = Date.now();
      warningRef.current = false;
      setWarning(false);
      storageWrite(activityKey, String(at));
      idle.current?.activity(at);
    } catch { await logout(); }
    finally { setRenewing(false); }
  }

  if (ending) return null;
  return <Context.Provider value={() => logout()}>
    {children}
    <Dialog open={warning}>
      <DialogContent onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()} className="[&>button]:hidden">
        <DialogHeader><DialogTitle>Your session is about to expire</DialogTitle>
          <DialogDescription>You have been inactive for a while. For your security, you will be signed out in {SESSION_CONFIG.warningMs / 60_000} minutes.</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => void logout()}>Log Out</Button><Button disabled={renewing} onClick={() => void continueSession()}>{renewing ? "Checking session…" : "Continue Session"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Context.Provider>;
}