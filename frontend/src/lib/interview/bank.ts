// Practice question bank. Questions are general practice material — never presented
// as questions a specific company has asked.
import { QUESTION_BANK } from "@/lib/data";

export type QKind = "technical" | "behavioral" | "project" | "hr";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type Question = { id: string; text: string; topic: string; kind: QKind; difficulty: Difficulty; focus: string; minutes: number; skill?: string };
export type InterviewType = "technical" | "hr" | "role" | "company";

export const TYPE_LABEL: Record<InterviewType, string> = { technical: "Technical interview", hr: "HR interview", role: "Role-specific interview", company: "Company preparation" };

const T = (skill: string, items: [Difficulty, string, string][]): Question[] =>
  items.map(([difficulty, text, focus], i) => ({ id: `t-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`, text, topic: skill, kind: "technical", difficulty, focus, minutes: difficulty === "Advanced" ? 4 : 3, skill }));

export const TECHNICAL: Question[] = [
  ...T("Java", [["Beginner", "What is the difference between == and equals() in Java?", "Reference vs value equality, overriding equals and hashCode"], ["Intermediate", "Explain how HashMap works internally.", "Hashing, buckets, collisions, resizing"], ["Advanced", "How does garbage collection work in the JVM, and how would you investigate a memory leak?", "Generations, GC roots, heap dumps, profiling tools"]]),
  ...T("Spring Boot", [["Intermediate", "Explain dependency injection in Spring Boot and why it is useful.", "Inversion of control, constructor injection, testability"], ["Intermediate", "How would you handle validation and errors in a Spring Boot REST API?", "Bean validation, @ControllerAdvice, status codes"], ["Advanced", "How do transactions work in Spring, and what can go wrong with @Transactional?", "Proxies, propagation, self-invocation pitfalls"]]),
  ...T("JavaScript", [["Beginner", "What is a closure in JavaScript? Give an example.", "Lexical scope, functions retaining variables"], ["Intermediate", "Explain the event loop and how promises are scheduled.", "Call stack, task and microtask queues"], ["Advanced", "How would you debounce a function, and when would you use it?", "Timers, closures, performance"]]),
  ...T("TypeScript", [["Intermediate", "When would you use a generic type in TypeScript?", "Reusable, type-safe functions and components"], ["Intermediate", "What is type narrowing and how does it work?", "typeof, in, discriminated unions"]]),
  ...T("React", [["Beginner", "What is the difference between props and state in React?", "Ownership of data, re-rendering"], ["Intermediate", "How does React decide when to re-render a component?", "State/props changes, reconciliation, memoisation"], ["Advanced", "How would you structure state for a large React application?", "Local vs shared state, server cache, context trade-offs"]]),
  ...T("REST APIs", [["Beginner", "What makes an API RESTful?", "Resources, HTTP verbs, statelessness"], ["Intermediate", "How would you design pagination for a REST endpoint?", "Offset vs cursor, consistency, performance"], ["Advanced", "How would you version and evolve a public API without breaking clients?", "Versioning strategies, deprecation, backward compatibility"]]),
  ...T("SQL", [["Beginner", "Explain the difference between INNER JOIN and LEFT JOIN.", "Matching rows, NULLs for missing matches"], ["Intermediate", "When should you add an index, and what does it cost?", "Read speed vs write cost, selectivity"], ["Advanced", "Explain transaction isolation levels and the anomalies they prevent.", "Dirty, non-repeatable and phantom reads"]]),
  ...T("Data Structures", [["Beginner", "When would you use a hash map instead of an array?", "Lookup cost, ordering, memory"], ["Intermediate", "How would you detect a cycle in a linked list?", "Fast and slow pointers, complexity"]]),
  ...T("Algorithms", [["Intermediate", "Explain the difference between BFS and DFS and when you'd use each.", "Queues vs stacks, shortest paths, memory"], ["Advanced", "How would you find the k most frequent elements in an array?", "Hash map plus heap or bucket sort, complexity"]]),
  ...T("Docker", [["Beginner", "What is the difference between a Docker image and a container?", "Templates vs running instances, layers"], ["Intermediate", "How would you make a Docker image smaller and faster to build?", "Multi-stage builds, layer caching, base images"]]),
  ...T("AWS", [["Intermediate", "How would you deploy a containerised web app on AWS?", "Compute choices, load balancing, IAM"]]),
  ...T("CI/CD", [["Intermediate", "What would a good CI pipeline for a web service include?", "Linting, tests, builds, deploy gates"]]),
  ...T("Git", [["Beginner", "Explain the difference between merge and rebase.", "History shape, conflicts, when each is safe"]]),
  ...T("Testing", [["Intermediate", "How do you decide what to unit test versus integration test?", "Cost, confidence, boundaries"]]),
  ...T("Accessibility", [["Intermediate", "How would you make a custom dropdown accessible?", "Keyboard support, roles, focus management"]]),
  ...T("System Design", [["Advanced", "Design a URL shortener. Walk through your main components.", "API, storage, ID generation, caching, scale"], ["Advanced", "How would you design a rate limiter?", "Algorithms, storage, distributed concerns"]]),
  ...T("Node.js", [["Intermediate", "How does Node.js handle many concurrent requests on a single thread?", "Event loop, non-blocking I/O"]]),
  ...T("Python", [["Beginner", "What is the difference between a list and a tuple in Python?", "Mutability, use cases"], ["Intermediate", "What are Python generators and why are they useful?", "Lazy evaluation, memory"]]),
  ...T("Statistics", [["Intermediate", "How would you explain a p-value to a non-technical stakeholder?", "Plain-language meaning, common misreadings"]]),
  ...T("Dashboards", [["Intermediate", "How do you decide what goes on a dashboard?", "Audience, key question, KPIs"]]),
  ...T("Spark", [["Advanced", "What causes a shuffle in Spark and why is it expensive?", "Wide transformations, network and disk cost"]]),
  ...T("Airflow", [["Advanced", "How do you make a data pipeline idempotent?", "Re-runs, partitions, upserts"]]),
];

const B = (id: string, text: string, topic: string, kind: QKind = "behavioral"): Question => ({ id, text, topic, kind, difficulty: "Intermediate", focus: kind === "hr" ? "Honest, specific and professional" : "A real situation, your own actions and the result", minutes: 2 });

export const HR: Question[] = [
  B("hr-intro", "Tell me about yourself.", "Introduction", "hr"),
  B("hr-why-role", "Why are you interested in this role?", "Motivation", "hr"),
  B("hr-strength", "What is a strength you bring to a team?", "Strengths", "hr"),
  B("hr-weakness", "Tell me about an area you are working to improve.", "Self-awareness", "hr"),
  B("hr-goals", "Where do you want to grow in the next two years?", "Career goals", "hr"),
  B("bh-conflict", "Describe a time you disagreed with a teammate. How did you handle it?", "Teamwork"),
  B("bh-deadline", "Tell me about a time you had to deliver under a tight deadline.", "Pressure"),
  B("bh-mistake", "Describe a mistake you made and what you learned from it.", "Learning"),
  B("bh-initiative", "Tell me about a time you took initiative without being asked.", "Ownership"),
  B("bh-feedback", "Tell me about a time you received difficult feedback.", "Growth"),
  B("pj-walk", "Walk me through a project you built end to end.", "Project explanation", "project"),
  B("pj-challenge", "What was the hardest technical problem in one of your projects, and how did you solve it?", "Project explanation", "project"),
  ...QUESTION_BANK.HR.filter((t) => !/yourself/i.test(t)).map((t, i) => B(`hr-legacy-${i}`, t, "General", "hr")),
];

export function companyQuestions(company: string, about: string): Question[] {
  return [
    { id: `co-why-${company}`, text: `Why do you want to work at ${company}?`, topic: "Company motivation", kind: "hr", difficulty: "Intermediate", focus: `Connect your goals to what ${company} does: ${about}`, minutes: 2 },
    { id: `co-product-${company}`, text: `What do you know about ${company}'s product, and how would you improve one part of it?`, topic: "Product sense", kind: "hr", difficulty: "Intermediate", focus: "Show research, then a specific, reasoned suggestion", minutes: 3 },
    { id: `co-values-${company}`, text: `Which kind of work environment helps you do your best work, and how does that fit ${company}?`, topic: "Culture fit", kind: "hr", difficulty: "Beginner", focus: "Honest preferences with an example", minutes: 2 },
  ];
}

export const shuffle = <X,>(a: X[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const DR: Record<Difficulty, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

export function pickQuestions(opts: { type: InterviewType; skills: string[]; prioritySkills: string[]; difficulty: Difficulty; count: number; topic?: string; company?: { name: string; about: string } | null }): Question[] {
  const tech = TECHNICAL.filter((q) => (opts.topic ? q.topic === opts.topic : opts.skills.includes(q.topic)) && DR[q.difficulty] <= DR[opts.difficulty]);
  const ordered = [...shuffle(tech.filter((q) => opts.prioritySkills.includes(q.topic))), ...shuffle(tech.filter((q) => !opts.prioritySkills.includes(q.topic)))];
  const hr = shuffle(HR);
  let out: Question[];
  if (opts.type === "technical") out = ordered;
  else if (opts.type === "hr") out = [HR[0]!, ...hr.filter((q) => q.id !== "hr-intro")];
  else if (opts.type === "role") out = [HR[0]!, ...interleave(ordered, hr.filter((q) => q.kind === "project" || q.kind === "behavioral"))];
  else out = [...(opts.company ? companyQuestions(opts.company.name, opts.company.about) : []), ...interleave(ordered, hr)];
  return Array.from(new Map(out.map((q) => [q.id, q])).values()).slice(0, opts.count);
}

function interleave<X>(a: X[], b: X[]): X[] {
  const out: X[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]!); if (b[i]) out.push(b[i]!); }
  return out;
}

export const COACH: Record<QKind, { checklist: string[]; structure: string[]; placeholder: string }> = {
  behavioral: { checklist: ["Did you explain the situation?", "Did you describe your own responsibility?", "Did you explain the actions you took?", "Did you describe the result or lesson learned?"], structure: ["Situation", "Task", "Action", "Result"], placeholder: "Situation → Task → Action → Result. Use a real example and say “I”, not “we”." },
  hr: { checklist: ["Is your answer honest and specific?", "Did you give a concrete example?", "Is it relevant to this role?", "Could you say it in under two minutes?"], structure: ["Direct answer", "Example from your experience", "Link to this role"], placeholder: "Answer directly, back it with one example, then link it to the role." },
  technical: { checklist: ["Did you explain the main concept?", "Did you explain how it works?", "Did you include a practical example?", "Did you mention relevant trade-offs?"], structure: ["Explain the concept", "Describe how it works", "Give a practical example", "Trade-offs or limitations"], placeholder: "1. What it is  2. How it works  3. An example  4. Trade-offs" },
  project: { checklist: ["What problem did the project solve?", "What was your personal contribution?", "Which technologies did you use?", "What challenges did you solve?", "What would you improve?"], structure: ["Problem", "Your role", "Tech choices", "Challenge & solution", "What you'd improve"], placeholder: "Problem → your role → tech choices → a challenge you solved → what you'd improve." },
};
