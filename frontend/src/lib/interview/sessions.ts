import { queryOptions } from "@tanstack/react-query";
import { db } from "@/services/backend";
import { getUserId } from "@/lib/user-data";
import type { Difficulty, InterviewType, Question } from "./bank";

export type Answer = { text: string; saved_at: string; revision?: boolean; checked?: string[]; bookmarked?: boolean };
export type Feedback = { strengths: string[]; missing: string[]; clarity: string; suggestions: string[]; structure: string[]; follow_ups: string[] };
export type Session = {
  id: string; interview_type: InterviewType; target_role: string | null; company: string | null; job_id: string | null;
  difficulty: Difficulty; practice_mode: "guided" | "mock"; questions: Question[]; answers: Record<string, Answer>;
  feedback: Record<string, Feedback>; status: "in_progress" | "completed"; current_index: number; created_at: string; updated_at: string;
};

const COLS = "id, interview_type, target_role, company, job_id, difficulty, practice_mode, questions, answers, feedback, status, current_index, created_at, updated_at";

export const sessionsQuery = queryOptions({
  queryKey: ["interview_sessions"],
  queryFn: async () => {
    const { data, error } = await db.from("interview_sessions").select(COLS).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as Session[];
  },
});

export async function createSession(s: Pick<Session, "interview_type" | "target_role" | "company" | "job_id" | "difficulty" | "practice_mode" | "questions">) {
  const user_id = await getUserId();
  const { data, error } = await db.from("interview_sessions").insert({ ...s, user_id, questions: s.questions as never }).select(COLS).single();
  if (error) throw error;
  return data as unknown as Session;
}

export async function updateSession(id: string, patch: Partial<Pick<Session, "answers" | "feedback" | "status" | "current_index">>) {
  const { error } = await db.from("interview_sessions").update({ ...(patch as Record<string, never>), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
