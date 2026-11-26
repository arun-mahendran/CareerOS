/**
 * Single switch between the two backends.
 *
 * - When VITE_API_URL is set (local / self-hosted): every sign-in, data read/write and AI call goes to the
 *   FastAPI server through src/services/api.ts. The built-in backend is never contacted.
 * - When it is not set (the hosted preview): the built-in backend is used.
 *
 * Pages and data modules only import `auth`, `db` and `ai` from here, never a backend client directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { API_BASE, ApiError, request, tokens, type ApiUser } from "./api";

export const USE_API = !!API_BASE;

export type AppUser = { id: string; email: string; full_name: string | null; avatar_url: string | null; target_role: string | null; role: "admin" | "candidate" };

// ------------------------------------------------------------------ auth

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let apiUserCache: Promise<AppUser | null> | null = null;
const fromApi = (u: ApiUser & { target_role?: string | null }): AppUser => ({
  id: u.id, email: u.email, full_name: u.full_name, avatar_url: u.avatar_url, target_role: u.target_role ?? null,
  role: u.role === "ADMIN" ? "admin" : "candidate",
});

async function cloudUser(): Promise<AppUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  const meta = u.user_metadata ?? {};
  const [{ data: p }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("full_name, target_role").eq("id", u.id).maybeSingle(),
    supabase.rpc("has_role", { _user_id: u.id, _role: "admin" }),
  ]);
  return {
    id: u.id, email: u.email ?? "",
    full_name: (p?.full_name ?? meta["full_name"] ?? meta["name"] ?? null) as string | null,
    avatar_url: (meta["avatar_url"] ?? meta["picture"] ?? null) as string | null,
    target_role: p?.target_role ?? null,
    role: isAdmin ? "admin" : "candidate",
  };
}

export const auth = {
  /** Current user, verified by the backend. null when signed out. */
  async getUser(): Promise<AppUser | null> {
    if (!USE_API) return cloudUser();
    if (!tokens.access && !tokens.refresh) return null;
    apiUserCache ??= request<ApiUser>("/auth/me").then(fromApi, () => { tokens.clear(); return null; });
    const u = await apiUserCache;
    if (!u) apiUserCache = null;
    return u;
  },
  async hasSession() {
    if (!USE_API) return !!(await supabase.auth.getSession()).data.session;
    return !!(tokens.access || tokens.refresh);
  },
  async validateSession() {
    auth.invalidate();
    const user = await auth.getUser();
    if (!user) throw new Error("Your session has expired. Please sign in again.");
    return user;
  },
  async isAdmin() {
    return (await auth.getUser())?.role === "admin";
  },
  async signIn(email: string, password: string) {
    if (!USE_API) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    }
    const r = await request<{ access_token: string; refresh_token: string }>("/auth/login", { method: "POST", body: { email, password }, auth: false });
    tokens.set(r.access_token, r.refresh_token);
    apiUserCache = null; emit();
  },
  /** Returns true when the account must confirm its email before signing in. */
  async signUp(name: string, email: string, password: string): Promise<boolean> {
    if (!USE_API) {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } } });
      if (error) throw error;
      return true;
    }
    const r = await request<{ access_token: string; refresh_token: string }>("/auth/register", { method: "POST", body: { name, email, password }, auth: false });
    tokens.set(r.access_token, r.refresh_token);
    apiUserCache = null; emit();
    return false;
  },
  async requestPasswordReset(email: string) {
    if (!USE_API) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) throw error;
      return;
    }
    await request("/auth/forgot-password", { method: "POST", body: { email }, auth: false });
  },
  /** `token` comes from the emailed link in FastAPI mode. */
  async updatePassword(password: string, token?: string | null) {
    if (!USE_API) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return;
    }
    if (!token) throw new Error("This reset link is invalid or has expired. Request a new one.");
    await request("/auth/reset-password", { method: "POST", body: { token, password }, auth: false });
  },
  async google() {
    if (!USE_API) {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
      if (r.error) throw new Error(r.error.message ?? "Google sign-in failed");
      return;
    }
    window.location.href = `${API_BASE}/auth/google/login`;
  },
  /** FastAPI Google flow: the backend redirects to /auth?code=… with a one-time code. */
  async completeGoogle(code: string) {
    const r = await request<{ access_token: string; refresh_token: string }>("/auth/google/exchange", { method: "POST", body: { code }, auth: false });
    tokens.set(r.access_token, r.refresh_token);
    apiUserCache = null; emit();
  },
  async signOut() {
    if (!USE_API) { await supabase.auth.signOut(); return; }
    await request("/auth/logout", { method: "POST" }).catch(() => undefined);
    tokens.clear(); apiUserCache = null; emit();
  },
  /** Fires on sign-in / sign-out / profile changes only. */
  onChange(cb: (signedIn: boolean) => void) {
    if (!USE_API) {
      const { data } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") cb(!!s);
      });
      return () => data.subscription.unsubscribe();
    }
    const l = () => cb(!!(tokens.access || tokens.refresh));
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  invalidate() { apiUserCache = null; },
};

export async function getUserId() {
  const u = await auth.getUser();
  if (!u) throw new Error("Not signed in");
  return u.id;
}

// ------------------------------------------------------------------ data

type Result<T = any> = { data: T; error: { message: string; code?: string } | null };
type Op = "select" | "insert" | "update" | "upsert" | "delete";

/**
 * Small query builder covering the operations the data modules use
 * (select/insert/update/upsert/delete + eq/order/limit/single/maybeSingle).
 * In FastAPI mode it maps to owner-scoped REST endpoints under /data/{resource};
 * the server always decides the owner from the session, never from the request.
 */
class ApiQuery implements PromiseLike<Result> {
  private op: Op = "select";
  private body: unknown;
  private filters: [string, string][] = [];
  private orderBy?: string;
  private max?: number;
  private one: "single" | "maybe" | null = null;
  private conflict: string | undefined;
  constructor(private table: string) {}
  select(_cols?: string) { return this; }
  insert(v: unknown) { this.op = "insert"; this.body = v; return this; }
  update(v: unknown) { this.op = "update"; this.body = v; return this; }
  upsert(v: unknown, o?: { onConflict?: string }) { this.op = "upsert"; this.body = v; this.conflict = o?.onConflict; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.filters.push([col, String(val)]); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = `${col}.${o?.ascending === false ? "desc" : "asc"}`; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  private async run(): Promise<Result> {
    const query: Record<string, string | number | undefined> = { order: this.orderBy, limit: this.max };
    for (const [c, v] of this.filters) query[`eq.${c}`] = v;
    const rows = (v: unknown) => (Array.isArray(v) ? v : [v]);
    const path = `/data/${this.table}`;
    try {
      let data: any[] = [];
      if (this.op === "select") data = await request<any[]>(path, { query });
      else if (this.op === "insert") data = await request<any[]>(path, { method: "POST", body: { rows: rows(this.body) } });
      else if (this.op === "upsert") data = await request<any[]>(path, { method: "PUT", body: { rows: rows(this.body), on_conflict: this.conflict } });
      else if (this.op === "update") data = await request<any[]>(path, { method: "PATCH", body: this.body, query });
      else { await request(path, { method: "DELETE", query }); data = []; }
      if (this.one === "single") return data[0] ? { data: data[0], error: null } : { data: null, error: { message: "Not found" } };
      if (this.one === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null };
    } catch (e) {
      const err = e as ApiError;
      return { data: null, error: { message: err.message, code: err.status === 409 ? "23505" : String(err.status ?? "") } };
    }
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, bad);
  }
}

export const db = {
  from(table: string): any {
    return USE_API ? new ApiQuery(table) : (supabase as unknown as { from: (t: string) => unknown }).from(table);
  },
};

// ------------------------------------------------------------------ AI (FastAPI mode only; preview uses server functions)

export type NotificationRecord = {
  id: string; type: string; title: string; body: string | null;
  link: string | null; read_at: string | null; created_at: string;
};

// Only the configured FastAPI server supplies notification records.
export const notifications = {
  list: () => request<NotificationRecord[]>("/notifications"),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  read: (id: string) => request<NotificationRecord>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" }),
  readAll: () => request<void>("/notifications/read-all", { method: "PUT" }),
};

export const ai = {
  interviewFeedback: (d: object) => request<{ ok: true; data: Record<string, string | string[]> } | { ok: false; error: string }>("/ai/interview/feedback", { method: "POST", body: d }),
  interviewModelAnswer: (d: object) => request<{ ok: true; data: Record<string, string | string[]> } | { ok: false; error: string }>("/ai/interview/model-answer", { method: "POST", body: d }),
  improveWording: (d: object) => request<{ ok: true; text: string } | { ok: false; error: string }>("/ai/resume/improve", { method: "POST", body: d }),
};

// ------------------------------------------------------------------ Opportunities (FastAPI mode only)

export type LiveJob = {
  id: string; slug: string; title: string; company_id: string; company: string; location: string;
  work_mode: string; level: string; salary: string | null; description: string; requirements: string[];
  skills: { name: string; required_level: number; importance: string }[];
  posted_at: string; posted_at_known: boolean; updated_at: string | null; first_seen_at: string | null;
  employment_type: string | null; department: string | null; is_new: boolean;
  source: { key: string; name: string; kind: string; is_demo: boolean };
  official_url: string; apply_url: string; status: string; saved: boolean;
};
export type LiveJobPage = {
  items: LiveJob[]; total: number; page: number; page_size: number;
  meta: { last_successful_sync: string | null; configured_sources: number; healthy_sources: number; new_jobs: number; new_window_hours: number; includes_demo: boolean } | null;
};
export type JobFilters = { [K in "q" | "mode" | "location" | "company_id" | "employment_type" | "skill" | "sort"]?: string | undefined } & { page?: number; page_size?: number };

export type JobSourceRecord = {
  id: string; key: string; name: string; kind: string; is_demo: boolean; enabled: boolean; status: string;
  last_success_at: string | null; last_checked_at: string | null; last_error: string | null;
  provider: string | null; board_token: string | null; region: string; company_id: string | null; company_name: string | null;
  careers_url: string | null; validated_at: string | null; monitored: boolean; syncing: boolean; job_count: number;
  last_fetched_count: number; last_new_count: number; last_updated_count: number; last_expired_count: number;
};
export type SyncResult = { ok: boolean; fetched: number; new: number; updated: number; unchanged: number; expired: number; notifications: number; error_kind: string | null; error: string | null };

export const jobs = {
  list: (f: JobFilters) => request<LiveJobPage>("/opportunities", { query: f }),
  get: (id: string) => request<LiveJob>(`/jobs/${encodeURIComponent(id)}`),
};

export type CompanyRecord = {
  id: string; slug: string; name: string; industry: string | null; headquarters: string | null; size: string | null;
  description: string | null; website_url: string | null; careers_url: string | null; logo_url: string | null;
  active_jobs: number; followed: boolean;
};
export const companyDirectory = {
  list: () => request<CompanyRecord[]>("/companies"),
  follow: (id: string) => request<void>(`/companies/${encodeURIComponent(id)}/follow`, { method: "POST" }),
  unfollow: (id: string) => request<void>(`/companies/${encodeURIComponent(id)}/follow`, { method: "DELETE" }),
};

export type AdminDashboard = { users: number; companies: number; jobs: number; applications: number; sources: number; sources_in_error: number };
export type AdminUserRecord = { id: string; email: string; role: string; is_active: boolean; created_at: string; name: string | null; target_role: string | null };
export type AdminJobRecord = { id: string; title: string; company: string; status: string; source: string; posted_at: string; location: string; official_url: string; apply_url: string };
export const admin = {
  dashboard: () => request<AdminDashboard>("/admin/dashboard"),
  users: () => request<AdminUserRecord[]>("/admin/users", { query: { limit: 100 } }),
  setUserActive: (id: string, active: boolean) => request<Pick<AdminUserRecord, "id" | "is_active">>(`/admin/users/${encodeURIComponent(id)}/active`, { method: "PUT", query: { active } }),
  companies: () => request<CompanyRecord[]>("/admin/companies"),
  jobs: () => request<AdminJobRecord[]>("/admin/jobs", { query: { limit: 100 } }),
  updateJob: (id: string, body: { status?: string; title?: string }) => request<Pick<AdminJobRecord, "id" | "status" | "title">>(`/admin/jobs/${encodeURIComponent(id)}`, { method: "PUT", body }),
};

export const jobSources = {
  list: () => request<JobSourceRecord[]>("/admin/job-sources"),
  create: (b: { provider: string; board_token: string; region?: string; company_name?: string; careers_url?: string | undefined }) =>
    request<JobSourceRecord>("/admin/job-sources", { method: "POST", body: b }),
  update: (id: string, b: { enabled?: boolean; board_token?: string; careers_url?: string }) =>
    request<JobSourceRecord>(`/admin/job-sources/${encodeURIComponent(id)}`, { method: "PUT", body: b }),
  test: (id: string) => request<SyncResult>(`/admin/job-sources/${encodeURIComponent(id)}/test`, { method: "POST" }),
  sync: (id: string) => request<SyncResult>(`/admin/job-sources/${encodeURIComponent(id)}/sync`, { method: "POST" }),
  remove: (id: string) => request<{ deleted: boolean; jobs_removed: number }>(`/admin/job-sources/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ------------------------------------------------------------------ Admin platform analytics (FastAPI only)

export type AnalyticsRange = { start: string; end: string; days: number; bucket: "daily" | "weekly" | "monthly" };
export type AnalyticsQuery = { days?: number; start?: string; end?: string };
export type SeriesPoint = { period: string; count: number };

export type AdminOverview = {
  range: AnalyticsRange;
  users: { total: number; new: number; growth_pct: number | null };
  jobs: { active: number; new: number };
  companies: { total: number; with_sources: number; new: number };
  active_users: { daily: number; monthly: number };
  applications: { total: number; new: number };
  engagement: { events: number };
};
export type AdminUsersAnalytics = { range: AnalyticsRange; registrations: SeriesPoint[]; cumulative: SeriesPoint[]; activity: SeriesPoint[] };
export type AdminJobsAnalytics = {
  range: AnalyticsRange; new_per_period: SeriesPoint[];
  by_company: { name: string; jobs: number }[]; by_role: { name: string; jobs: number }[]; by_location: { name: string; jobs: number }[];
  sources: { id: string; name: string; provider: string | null; status: string; enabled: boolean; is_demo: boolean; jobs: number; last_fetched: number; last_new: number; last_updated: number; last_expired: number; last_success_at: string | null; last_error: string | null }[];
};
export type AdminEngagement = {
  range: AnalyticsRange;
  most_followed: { name: string; followers: number }[];
  searched_roles: { term: string; count: number }[];
  feature_usage: { kind: string; events: number; users: number }[];
  activity: { daily_active: number; weekly_active: number; monthly_active: number; new_registrations: number; returning_users: number; active_in_range: number };
};
export type AdminNotificationsAnalytics = {
  range: AnalyticsRange; total: number; read: number;
  by_type: { type: string; count: number }[]; series: SeriesPoint[];
  email: { configured: boolean; note: string };
};
export type AdminInsights = { range: { start: string; end: string; days: number }; insights: { kind: string; text: string }[] };

const aq = (q: AnalyticsQuery) => (q.start && q.end ? { start: q.start, end: q.end } : { days: q.days ?? 30 });

export const adminAnalytics = {
  overview: (q: AnalyticsQuery) => request<AdminOverview>("/admin/analytics/overview", { query: aq(q) }),
  users: (q: AnalyticsQuery) => request<AdminUsersAnalytics>("/admin/analytics/users", { query: aq(q) }),
  jobs: (q: AnalyticsQuery) => request<AdminJobsAnalytics>("/admin/analytics/jobs", { query: aq(q) }),
  engagement: (q: AnalyticsQuery) => request<AdminEngagement>("/admin/analytics/engagement", { query: aq(q) }),
  notifications: (q: AnalyticsQuery) => request<AdminNotificationsAnalytics>("/admin/analytics/notifications", { query: aq(q) }),
  insights: (q: AnalyticsQuery) => request<AdminInsights>("/admin/analytics/insights", { query: aq(q) }),
};

// ------------------------------------------------------------------ Calendar (FastAPI /calendar/events, or the built-in table)

export type CalendarEventRecord = {
  id: string; type: string; title: string; notes: string | null; location: string | null; all_day: boolean;
  starts_at: string; ends_at: string | null; application_id: string | null;
};
export type CalendarEventInput = Omit<CalendarEventRecord, "id">;

const calTable = () => (supabase as unknown as { from: (t: string) => any }).from("calendar_events");
const cloud = async <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
};
const CAL_COLS = "id,type,title,notes,location,all_day,starts_at,ends_at,application_id";

export const calendarEvents = {
  list: (start: string, end: string): Promise<CalendarEventRecord[]> => USE_API
    ? request<CalendarEventRecord[]>("/calendar/events", { query: { start, end } })
    : cloud(calTable().select(CAL_COLS).gte("starts_at", start).lte("starts_at", end).order("starts_at")),
  create: (b: CalendarEventInput): Promise<CalendarEventRecord> => USE_API
    ? request<CalendarEventRecord>("/calendar/events", { method: "POST", body: b })
    : cloud(calTable().insert(b).select(CAL_COLS).single()),
  update: (id: string, b: Partial<CalendarEventInput>): Promise<CalendarEventRecord> => USE_API
    ? request<CalendarEventRecord>(`/calendar/events/${encodeURIComponent(id)}`, { method: "PATCH", body: b })
    : cloud(calTable().update(b).eq("id", id).select(CAL_COLS).single()),
  remove: async (id: string): Promise<void> => {
    if (USE_API) return request<void>(`/calendar/events/${encodeURIComponent(id)}`, { method: "DELETE" });
    await cloud(calTable().delete().eq("id", id));
  },
};
