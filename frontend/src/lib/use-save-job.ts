import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/services/backend";
import { savedJobsQuery, getUserId } from "@/lib/user-data";
import type { Job } from "@/lib/data";

export function useSavedJobs() {
  const qc = useQueryClient();
  const { data: saved = [] } = useQuery(savedJobsQuery);

  const save = useMutation({
    mutationFn: async ({ jobId, status = "saved", job }: { jobId: string; status?: string; job?: Job }) => {
      const user_id = await getUserId();
      const details = job ? {
        company: job.company, title: job.title, location: job.location, job_url: job.portal,
        salary: job.salary === "Not specified" ? null : job.salary,
        job_type: job.level === "Intern" ? "Internship" : null,
      } : {};
      const { error } = await db.from("saved_jobs").upsert({ user_id, job_id: jobId, status, ...details }, { onConflict: "user_id,job_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_jobs"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await db.from("saved_jobs").delete().eq("job_id", jobId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_jobs"] }),
  });

  return { saved, save, remove, statusOf: (id: string) => saved.find((s) => s.job_id === id)?.status };
}
