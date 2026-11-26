import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RULES = `You rewrite resume text for clarity and professional tone.
STRICT RULES:
- Use ONLY facts present in the input. Never add skills, tools, employers, dates, certifications, achievements, metrics, percentages or results.
- Keep the same meaning; do not exaggerate.
- Keep roughly the same length. Plain text only, no markdown, no quotes.
- If the input is too thin to improve without inventing facts, return it lightly polished.`;

export const improveWording = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(["summary", "bullet", "project"]), text: z.string().min(10).max(2000), role: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "Wording suggestions aren't available right now." };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: RULES },
          { role: "user", content: `Type: ${data.kind}${data.role ? `\nTarget role: ${data.role}` : ""}\n\nText:\n${data.text}` },
        ],
      }),
    });
    if (res.status === 429) return { ok: false as const, error: "Too many requests — try again in a minute." };
    if (res.status === 402) return { ok: false as const, error: "AI credits are used up for this workspace." };
    if (!res.ok) return { ok: false as const, error: "Couldn't get a suggestion. Try again." };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true as const, text } : { ok: false as const, error: "No suggestion returned." };
  });
