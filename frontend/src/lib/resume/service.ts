// Resume persistence. Swap these functions for src/services/api.ts calls
// once the FastAPI server is hosted; the editor only depends on this module.
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import type { ResumeData, TemplateId } from "./model";

export type ResumeRecord = {
  id: string;
  title: string;
  target_role: string | null;
  template: TemplateId;
  target_job_id: string | null;
  data: ResumeData | null;
  updated_at: string;
};

// The generated types don't include this table yet.
const table = () => db.from("resumes");
const COLS = "id, title, target_role, template, target_job_id, data, updated_at";

export const resumesQuery = queryOptions({
  queryKey: ["resumes"],
  queryFn: async (): Promise<ResumeRecord[]> => {
    const { data, error } = await table().select(COLS).order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export async function createResume(input: Partial<Omit<ResumeRecord, "id" | "updated_at">>): Promise<ResumeRecord> {
  const { data, error } = await table().insert(input).select(COLS).single();
  if (error) throw error;
  return data;
}

export async function saveResume(id: string, patch: Partial<Omit<ResumeRecord, "id" | "updated_at">>): Promise<ResumeRecord> {
  const { data, error } = await table().update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(COLS).single();
  if (error) throw error;
  return data;
}

export async function deleteResume(id: string) {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}
