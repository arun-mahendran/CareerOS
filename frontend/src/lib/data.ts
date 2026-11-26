export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: "Remote" | "Hybrid" | "On-site" | "Not specified";
  level: "Intern" | "Entry" | "Associate" | "Not specified";
  salary: string;
  posted: string;
  /** Null unless a real, explained match calculation is available. */
  match: number | null;
  skills: string[];
  missing: string[];
  about: string;
  responsibilities: string[];
  portal: string;
  /** Server company id, when the listing came from the CareerOS server. */
  companyId?: string;
};

export const LIFECYCLE = [
  "Discover",
  "Fit",
  "Skill gaps",
  "Roadmap",
  "Resume",
  "Interview",
  "Apply",
  "Track",
  "Grow",
] as const;

export type Company = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  hq: string;
  website: string;
  careers: string;
  logo: string;
  about: string;
  activeJobs: number;
  followed: boolean;
};

export type Resource = { id: string; title: string; provider: string; url: string; category: string; difficulty: "Beginner" | "Intermediate" | "Advanced"; minutes: number; skill: string };

/** Public learning references used to supplement the roadmap's resource catalog. */
export const RESOURCES: Resource[] = [
  { id: "ts-handbook", title: "TypeScript Handbook", provider: "typescriptlang.org", url: "https://www.typescriptlang.org/docs/handbook/intro.html", category: "Frontend", difficulty: "Intermediate", minutes: 240, skill: "TypeScript" },
  { id: "testing-lib", title: "Testing Library docs", provider: "testing-library.com", url: "https://testing-library.com/docs/", category: "Quality", difficulty: "Beginner", minutes: 120, skill: "Testing" },
  { id: "webdev-a11y", title: "Learn Accessibility", provider: "web.dev", url: "https://web.dev/learn/accessibility", category: "Quality", difficulty: "Beginner", minutes: 180, skill: "Accessibility" },
  { id: "sqlbolt", title: "SQLBolt interactive lessons", provider: "sqlbolt.com", url: "https://sqlbolt.com", category: "Data", difficulty: "Beginner", minutes: 150, skill: "SQL" },
  { id: "fe-sd", title: "Front-end system design playbook", provider: "GreatFrontEnd", url: "https://www.greatfrontend.com/front-end-system-design-playbook", category: "Advanced", difficulty: "Advanced", minutes: 300, skill: "System Design" },
  { id: "react-learn", title: "React — Learn", provider: "react.dev", url: "https://react.dev/learn", category: "Frontend", difficulty: "Beginner", minutes: 200, skill: "React" },
];

export const QUESTION_BANK: Record<"Technical" | "HR" | "Role" | "Company", string[]> = {
  Technical: ["Walk through a project you built end to end.", "How do you debug a production issue?", "Explain how React decides to re-render.", "How would you test a form component?"],
  HR: ["Tell me about yourself.", "Describe a time you handled disagreement.", "What are you looking for in your next role?", "Why are you leaving / joining now?"],
  Role: ["What does success look like in your first 90 days?", "Which of your skills fits this role best?", "How do you prioritise competing work?"],
  Company: ["What do you know about our product?", "Which of our values resonates with you?", "How would you improve one of our products?"],
};
