import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RULES = `You are an interview practice coach. This is practice feedback, not an employer assessment.
STRICT RULES:
- Judge only what the candidate wrote. Never invent experience, projects, employers, metrics or achievements for them.
- Do not predict whether they would pass an interview. Do not give numeric scores.
- Technical answers: assess conceptual accuracy and completeness. Behavioral answers: relevance, clarity, structure and whether there is a meaningful result. HR answers: encourage honest, specific, professional responses.
- Be concise, specific and kind.`;

const Input = z.object({
  question: z.string().min(5).max(500),
  kind: z.enum(["technical", "behavioral", "project", "hr"]),
  topic: z.string().max(80),
  role: z.string().max(120).optional(),
  answer: z.string().max(6000).optional(),
});

async function call(tool: { name: string; parameters: object }, user: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false as const, error: "The interview coach isn't available right now." };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: RULES }, { role: "user", content: user }],
      tools: [{ type: "function", function: { name: tool.name, description: "Return structured output", parameters: tool.parameters } }],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });
  if (res.status === 429) return { ok: false as const, error: "Too many requests — try again in a minute. Your answer is safe." };
  if (res.status === 402) return { ok: false as const, error: "AI credits are used up for this workspace. Your answer is safe." };
  if (!res.ok) return { ok: false as const, error: "Couldn't get feedback. Your answer is safe — try again." };
  const json = (await res.json()) as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  try { return { ok: true as const, data: JSON.parse(args ?? "") as Record<string, string | string[]> }; }
  catch { return { ok: false as const, error: "The coach returned an unreadable response. Try again." }; }
}

const list = { type: "array", items: { type: "string" } };

export const evaluateAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.extend({ answer: z.string().min(20).max(6000) }).parse(d))
  .handler(async ({ data }) => call(
    { name: "feedback", parameters: { type: "object", properties: { strengths: list, missing: list, clarity: { type: "string" }, suggestions: list, structure: list, follow_ups: list }, required: ["strengths", "missing", "clarity", "suggestions", "structure", "follow_ups"] } },
    `Question type: ${data.kind}\nTopic: ${data.topic}${data.role ? `\nTarget role: ${data.role}` : ""}\nQuestion: ${data.question}\n\nCandidate answer:\n${data.answer}\n\nGive: strengths (what they explained well), missing (concepts or parts missing), clarity (one or two sentences on clarity and completeness), suggestions (specific improvements), structure (a better answer outline using only their content plus missing concepts), follow_ups (2-3 follow-up questions).`,
  ));

export const modelAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => call(
    { name: "model_answer", parameters: { type: "object", properties: { key_points: list, example: { type: "string" }, why: { type: "string" }, mistakes: list, follow_ups: list }, required: ["key_points", "example", "why", "mistakes", "follow_ups"] } },
    `Question type: ${data.kind}\nTopic: ${data.topic}${data.role ? `\nTarget role: ${data.role}` : ""}\nQuestion: ${data.question}\n\nWrite a suggested answer guide. For behavioral/HR/project questions, the example must be a clearly generic template with [placeholders] for the candidate's own details — never a made-up personal story. Keep the example under 150 words.`,
  ));
