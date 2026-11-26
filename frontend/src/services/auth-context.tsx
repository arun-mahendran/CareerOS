/**
 * Centralized auth state for the FastAPI backend (JWT). Ready to mount in __root once the
 * FastAPI server is hosted; until then the app keeps using the current sign-in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokens, type ApiUser, type AuthResponse, type Role } from "./api";

type Status = "loading" | "authenticated" | "anonymous";
type AuthState = {
  user: ApiUser | null;
  role: Role | null;
  status: Status;
  isAuthenticated: boolean;
  hasRole: (r: Role) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function ApiAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!tokens.access && !tokens.refresh) return setStatus("anonymous");
    api.auth.me().then(
      (u) => { setUser(u); setStatus("authenticated"); },
      () => { tokens.clear(); setStatus("anonymous"); },
    );
  }, []);

  const accept = useCallback((r: AuthResponse) => {
    tokens.set(r.access_token, r.refresh_token);
    setUser(r.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    role: user?.role ?? null,
    status,
    isAuthenticated: status === "authenticated",
    hasRole: (r) => user?.role === r,
    login: async (email, password) => accept(await api.auth.login({ email, password })),
    register: async (name, email, password) => accept(await api.auth.register({ name, email, password })),
    logout: async () => {
      await api.auth.logout().catch(() => undefined);
      tokens.clear();
      setUser(null);
      setStatus("anonymous");
    },
  }), [user, status, accept]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApiAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApiAuth must be used inside ApiAuthProvider");
  return v;
}
