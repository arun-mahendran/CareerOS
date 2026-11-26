import { queryOptions } from "@tanstack/react-query";
import { auth, db, getUserId } from "@/services/backend";

export { getUserId };

export type SavedJob = { id: string; job_id: string; status: string; created_at: string };

export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;

export const savedJobsQuery = queryOptions({
  queryKey: ["saved_jobs"],
  queryFn: async () => {
    const { data, error } = await db.from("saved_jobs").select("id, job_id, status, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedJob[];
  },
});

export const progressQuery = queryOptions({
  queryKey: ["roadmap_progress"],
  queryFn: async () => {
    const { data, error } = await db.from("roadmap_progress").select("step_id").eq("status", "completed");
    if (error) throw error;
    return ((data ?? []) as { step_id: string }[]).map((r) => r.step_id);
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    auth.invalidate();
    const u = await auth.getUser();
    if (!u) return null;
    return {
      email: u.email,
      full_name: u.full_name,
      target_role: u.target_role ?? "Frontend Engineer",
      avatar_url: u.avatar_url,
      role: u.role,
    };
  },
});

export async function updateProfile(patch: { full_name?: string | null; target_role?: string }) {
  const id = await getUserId();
  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
  auth.invalidate();
}
