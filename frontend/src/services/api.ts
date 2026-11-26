/**
 * Central REST client for the CareerOS FastAPI backend.
 * Base URL comes from VITE_API_URL (e.g. http://localhost:8000/api/v1). No secrets live here.
 * Screens reach it through src/services/backend.ts, which switches on when VITE_API_URL is set.
 */

const BASE = (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
export const API_BASE = BASE;

const ACCESS = "careeros.access";
const REFRESH = "careeros.refresh";
let credentialGeneration = 0;
export const SESSION_ENDED_EVENT = "careeros:session-ended";

export const tokens = {
  get access() {
    return typeof window === "undefined" ? null : sessionStorage.getItem(ACCESS);
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    sessionStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    credentialGeneration++;
    sessionStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

const FRIENDLY: Record<number, string> = {
  400: "That request couldn't be processed.",
  401: "Please sign in again.",
  403: "You don't have access to this.",
  404: "We couldn't find that.",
  409: "This conflicts with something that already exists.",
  422: "Some fields need attention.",
  500: "Something went wrong. Please try again.",
};

type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> | undefined; raw?: boolean; auth?: boolean };

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const rt = tokens.refresh;
  const generation = credentialGeneration;
  if (!rt) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      const d = (await r.json()) as AuthResponse;
      if (generation !== credentialGeneration || tokens.refresh !== rt) return false;
      tokens.set(d.access_token, d.refresh_token);
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function request<T = unknown>(path: string, o: Opts = {}, retried = false): Promise<T> {
  const qs = o.query
    ? "?" + new URLSearchParams(Object.entries(o.query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString()
    : "";
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (o.auth !== false && tokens.access) headers["Authorization"] = `Bearer ${tokens.access}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { method: o.method ?? "GET", headers, body: o.body === undefined ? null : JSON.stringify(o.body) });
  } catch {
    throw new ApiError(0, "Can't reach CareerOS right now. Check your connection.");
  }
  if (res.status === 401 && o.auth !== false && !retried && (await tryRefresh())) return request<T>(path, o, true);
  if (!res.ok) {
    let msg = FRIENDLY[res.status] ?? "Something went wrong. Please try again.";
    let details: unknown;
    try {
      const j = (await res.json()) as { error?: { message?: string; details?: unknown } };
      if (j.error?.message && res.status < 500) msg = j.error.message;
      details = j.error?.details;
    } catch { /* non-JSON */ }
    if (res.status === 401) tokens.clear();
    throw new ApiError(res.status, msg, details);
  }
  if (o.raw) return (await res.blob()) as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(p: string, query?: Opts["query"]) => request<T>(p, { query });
const post = <T>(p: string, body?: unknown, query?: Opts["query"]) => request<T>(p, { method: "POST", body, query });
const put = <T>(p: string, body?: unknown) => request<T>(p, { method: "PUT", body });
const del = <T = void>(p: string) => request<T>(p, { method: "DELETE" });

export type Role = "CANDIDATE" | "ADMIN";
export type ApiUser = { id: string; email: string; role: Role; full_name: string | null; avatar_url: string | null };
export type AuthResponse = { access_token: string; refresh_token: string; expires_in: number; user: ApiUser };
export type AppStatus = "SAVED" | "APPLIED" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN";

export const api = {
  auth: {
    register: (b: { name: string; email: string; password: string }) => request<AuthResponse>("/auth/register", { method: "POST", body: b, auth: false }),
    login: (b: { email: string; password: string }) => request<AuthResponse>("/auth/login", { method: "POST", body: b, auth: false }),
    me: () => get<ApiUser>("/auth/me"),
    logout: () => post<void>("/auth/logout"),
  },
  profile: {
    get: () => get("/profile"),
    update: (b: unknown) => put("/profile", b),
    list: (section: "education" | "experience" | "projects" | "certifications" | "skills") => get(`/profile/${section}`),
    add: (section: string, b: unknown) => post(`/profile/${section}`, b),
    update_item: (section: string, id: string, b: unknown) => put(`/profile/${section}/${id}`, b),
    remove: (section: string, id: string) => del(`/profile/${section}/${id}`),
  },
  careerGoals: { list: () => get("/career-goals"), create: (b: unknown) => post("/career-goals", b), update: (id: string, b: unknown) => put(`/career-goals/${id}`, b) },
  jobs: {
    list: (q?: Opts["query"]) => get("/jobs", q),
    search: (q: string, page = 1) => get("/jobs/search", { q, page }),
    get: (id: string) => get(`/jobs/${id}`),
    match: (id: string) => get(`/jobs/${id}/match`),
    save: (id: string) => post<void>(`/jobs/${id}/save`),
    unsave: (id: string) => del(`/jobs/${id}/save`),
    saved: () => get("/jobs/saved"),
  },
  companies: {
    list: (q?: string) => get("/companies", { q }),
    get: (id: string) => get(`/companies/${id}`),
    jobs: (id: string) => get(`/companies/${id}/jobs`),
    follow: (id: string) => post<void>(`/companies/${id}/follow`),
    unfollow: (id: string) => del(`/companies/${id}/follow`),
    followed: () => get("/companies/followed"),
  },
  skillGaps: {
    analyze: (b: { target_type: "ROLE" | "JOB"; target_role?: string; job_id?: string; use_ai_actions?: boolean }) => post("/skill-gaps/analyze", b),
    list: () => get("/skill-gaps"),
    get: (id: string) => get(`/skill-gaps/${id}`),
  },
  roadmaps: {
    generate: (b: { target_role?: string; skill_gap_id?: string; desired_skills?: string[] }) => post("/roadmaps/generate", b),
    list: () => get("/roadmaps"),
    get: (id: string) => get(`/roadmaps/${id}`),
    progress: (id: string, completed_item_ids: string[]) => put(`/roadmaps/${id}/progress`, { completed_item_ids }),
    complete: (itemId: string, completed = true) => put(`/roadmaps/items/${itemId}/complete`, { completed }),
  },
  resources: {
    list: (q?: { category?: string; difficulty?: string }) => get("/resources", q),
    get: (id: string) => get(`/resources/${id}`),
    recommended: () => get("/resources/recommended"),
    bookmark: (id: string, progress?: number) => post(`/resources/${id}/bookmark`, progress === undefined ? undefined : { progress }),
    unbookmark: (id: string) => del(`/resources/${id}/bookmark`),
  },
  resumes: {
    list: () => get("/resumes"),
    create: (b: unknown) => post("/resumes", b),
    get: (id: string) => get(`/resumes/${id}`),
    update: (id: string, b: unknown) => put(`/resumes/${id}`, b),
    remove: (id: string) => del(`/resumes/${id}`),
    tailor: (id: string, job_id: string) => post(`/resumes/${id}/tailor`, { job_id }),
    analyze: (id: string, job_id?: string) => post(`/resumes/${id}/analyze`, undefined, { job_id }),
    exportPdf: (id: string) => request<Blob>(`/resumes/${id}/export/pdf`, { method: "POST", raw: true }),
    exportDocx: (id: string) => request<Blob>(`/resumes/${id}/export/docx`, { method: "POST", raw: true }),
  },
  interviews: {
    list: () => get("/interviews"),
    create: (b: unknown) => post("/interviews", b),
    get: (id: string) => get(`/interviews/${id}`),
    questions: (id: string, count = 8) => post(`/interviews/${id}/questions`, { count }),
    mock: (id: string, question_id: string, answer: string) => post(`/interviews/${id}/mock`, { question_id, answer }),
    feedback: (id: string, question_id: string, answer: string) => post(`/interviews/${id}/feedback`, { question_id, answer }),
  },
  applications: {
    list: () => get("/applications"),
    create: (b: unknown) => post("/applications", b),
    get: (id: string) => get(`/applications/${id}`),
    update: (id: string, b: unknown) => put(`/applications/${id}`, b),
    remove: (id: string) => del(`/applications/${id}`),
    status: (id: string, status: AppStatus) => put(`/applications/${id}/status`, { status }),
    note: (id: string, body: string) => post(`/applications/${id}/notes`, { body }),
  },
  calendar: {
    list: (start?: string, end?: string) => get("/calendar/events", { start, end }),
    create: (b: unknown) => post("/calendar/events", b),
    update: (id: string, b: unknown) => put(`/calendar/events/${id}`, b),
    remove: (id: string) => del(`/calendar/events/${id}`),
  },
  notifications: { list: (unread = false) => get("/notifications", { unread }), read: (id: string) => put(`/notifications/${id}/read`), readAll: () => put("/notifications/read-all") },
  analytics: { summary: () => get("/analytics/dashboard"), applications: () => get("/analytics/applications"), skills: () => get("/analytics/skills"), activity: () => get("/analytics/activity") },
  dashboard: () => get("/dashboard"),
  admin: {
    dashboard: () => get("/admin/dashboard"),
    users: () => get("/admin/users"),
    companies: () => get("/admin/companies"),
    jobs: () => get("/admin/jobs"),
    sources: () => get("/admin/sources"),
    auditLogs: () => get("/admin/audit-logs"),
  },
};
