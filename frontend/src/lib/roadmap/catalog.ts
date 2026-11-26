// Role-based roadmap catalog. Resource URLs point only to official docs or
// well-known learning sites; activities without a verified link show none.

export type ResourceKind = "Read" | "Watch" | "Practice" | "Build";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type ActivityResource = { kind: ResourceKind; title: string; provider: string; url: string };

export type Activity = {
  id: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  hours: number;
  /** Skill name used to match the candidate's skill-gap data. */
  skill?: string;
  prereqs?: string[];
  objectives: string[];
  concepts: string[];
  practice: string[];
  project?: string;
  criteria: string[];
  resources: ActivityResource[];
};

export type Phase = { id: string; title: string; description: string; activities: string[] };
export type RoleRoadmap = { role: string; phases: Phase[] };

const R = (kind: ResourceKind, title: string, provider: string, url: string): ActivityResource => ({ kind, title, provider, url });

const LEETCODE = R("Practice", "Problem set", "LeetCode", "https://leetcode.com/problemset/");
const NEETCODE = R("Practice", "NeetCode roadmap", "neetcode.io", "https://neetcode.io/roadmap");
const SD_PRIMER = R("Read", "System Design Primer", "GitHub", "https://github.com/donnemartin/system-design-primer");

export const ACTIVITIES: Record<string, Activity> = {
  // ---------- Shared foundations ----------
  "git-basics": {
    id: "git-basics", title: "Git & GitHub workflow", summary: "Branch, commit, review and resolve conflicts like a team engineer.",
    difficulty: "Beginner", hours: 4, skill: "Git",
    objectives: ["Use branches for every change", "Write clear commit messages", "Open and review pull requests"],
    concepts: ["Staging and commits", "Branching and merging", "Rebasing basics", "Resolving merge conflicts"],
    practice: ["Create a repo, make three feature branches and merge them through pull requests"],
    criteria: ["You can explain merge vs rebase", "A public repo shows a clean PR history"],
    resources: [R("Read", "Pro Git book", "git-scm.com", "https://git-scm.com/book/en/v2"), R("Practice", "GitHub Skills", "GitHub", "https://skills.github.com/")],
  },
  "js-core": {
    id: "js-core", title: "Modern JavaScript", summary: "Closures, async/await, modules and the event loop.",
    difficulty: "Beginner", hours: 8, skill: "JavaScript",
    objectives: ["Write idiomatic ES2020+ code", "Reason about async control flow"],
    concepts: ["Scope and closures", "Promises and async/await", "Modules", "Array methods", "The event loop"],
    practice: ["Fetch data from a public API and render a filtered list without a framework"],
    criteria: ["You can explain what happens when an awaited promise rejects", "Exercise works without console errors"],
    resources: [R("Read", "JavaScript guide", "MDN", "https://developer.mozilla.org/en-US/docs/Learn/JavaScript")],
  },
  "ts-core": {
    id: "ts-core", title: "TypeScript generics & narrowing", summary: "Type real-world code safely without fighting the compiler.",
    difficulty: "Intermediate", hours: 6, skill: "TypeScript", prereqs: ["js-core"],
    objectives: ["Model data with unions and generics", "Narrow types instead of casting"],
    concepts: ["Union and intersection types", "Generics", "Type narrowing", "Utility types"],
    practice: ["Convert a small JavaScript module to strict TypeScript with no `any`"],
    criteria: ["Strict mode passes", "You can explain when to use a generic"],
    resources: [R("Read", "TypeScript Handbook", "typescriptlang.org", "https://www.typescriptlang.org/docs/handbook/intro.html")],
  },
  "react-core": {
    id: "react-core", title: "React components & state", summary: "Build interfaces from components, props, state and effects.",
    difficulty: "Intermediate", hours: 10, skill: "React", prereqs: ["js-core"],
    objectives: ["Split UI into reusable components", "Manage local and shared state", "Use effects only when needed"],
    concepts: ["Components and props", "State and events", "Lists and keys", "Effects", "Custom hooks"],
    practice: ["Build a task list with filtering and persisted state"],
    criteria: ["Components are reusable", "No unnecessary effects"],
    resources: [R("Read", "React — Learn", "react.dev", "https://react.dev/learn")],
  },
  "react-api": {
    id: "react-api", title: "API integration in React", summary: "Load, cache and mutate server data with proper loading and error states.",
    difficulty: "Intermediate", hours: 6, skill: "REST APIs", prereqs: ["react-core"],
    objectives: ["Handle loading, error and empty states", "Keep server data in sync after mutations"],
    concepts: ["fetch and HTTP verbs", "Loading and error UI", "Optimistic updates", "Caching"],
    practice: ["Connect a React page to a REST API with create, update and delete"],
    criteria: ["All three states (loading, error, empty) are handled"],
    resources: [R("Read", "HTTP overview", "MDN", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"), R("Read", "TanStack Query docs", "tanstack.com", "https://tanstack.com/query/latest/docs/framework/react/overview")],
  },
  "a11y": {
    id: "a11y", title: "Accessibility fundamentals", summary: "Semantic HTML, keyboard support and ARIA where it is truly needed.",
    difficulty: "Beginner", hours: 5, skill: "Accessibility",
    objectives: ["Use semantic elements first", "Make every action keyboard accessible", "Check contrast"],
    concepts: ["Semantic HTML", "Focus management", "ARIA roles and labels", "Colour contrast"],
    practice: ["Audit one of your pages with keyboard-only navigation and fix the issues"],
    criteria: ["Page is fully usable with keyboard", "No critical issues in an automated audit"],
    resources: [R("Read", "Learn Accessibility", "web.dev", "https://web.dev/learn/accessibility")],
  },
  "fe-testing": {
    id: "fe-testing", title: "Component testing", summary: "Write tests the way users interact with your UI.",
    difficulty: "Intermediate", hours: 8, skill: "Testing", prereqs: ["react-core"],
    objectives: ["Test behaviour, not implementation", "Mock network calls"],
    concepts: ["Queries by role", "User events", "Async assertions", "Mocking requests"],
    practice: ["Add tests for a form: validation, submit and error state"],
    criteria: ["Tests pass in CI", "Tests query by role or label"],
    resources: [R("Read", "Testing Library docs", "testing-library.com", "https://testing-library.com/docs/"), R("Read", "Vitest guide", "vitest.dev", "https://vitest.dev/guide/")],
  },
  "fe-sd": {
    id: "fe-sd", title: "Frontend system design", summary: "Rendering strategies, state architecture and performance budgets.",
    difficulty: "Advanced", hours: 10, skill: "System Design", prereqs: ["react-api"],
    objectives: ["Choose a rendering strategy and justify it", "Design state for a complex page"],
    concepts: ["CSR, SSR and static rendering", "Caching layers", "Performance metrics", "Component API design"],
    practice: ["Write a one-page design for a news feed with infinite scroll"],
    criteria: ["Design covers data flow, caching and failure states"],
    resources: [R("Read", "Front-end system design playbook", "GreatFrontEnd", "https://www.greatfrontend.com/front-end-system-design-playbook")],
  },
  "dsa-arrays": {
    id: "dsa-arrays", title: "Arrays, strings & hashing", summary: "The patterns behind most screening questions.",
    difficulty: "Beginner", hours: 8, skill: "Data Structures",
    objectives: ["Recognise two-pointer and sliding-window problems", "Use hash maps to cut complexity"],
    concepts: ["Big-O analysis", "Two pointers", "Sliding window", "Hash maps and sets"],
    practice: ["Solve 15 easy and 5 medium array/hashing problems"],
    criteria: ["You can state time and space complexity for each solution"],
    resources: [NEETCODE, LEETCODE],
  },
  "dsa-structures": {
    id: "dsa-structures", title: "Linked lists, stacks & queues", summary: "Pointer manipulation and LIFO/FIFO reasoning.",
    difficulty: "Intermediate", hours: 8, skill: "Data Structures", prereqs: ["dsa-arrays"],
    objectives: ["Reverse and merge lists confidently", "Use stacks for parsing problems"],
    concepts: ["Singly and doubly linked lists", "Stacks", "Queues and deques", "Monotonic stacks"],
    practice: ["Solve 10 linked-list and stack problems"],
    criteria: ["Solutions handle empty and single-element inputs"],
    resources: [NEETCODE, LEETCODE],
  },
  "dsa-trees": {
    id: "dsa-trees", title: "Trees & recursion", summary: "Traversals, recursion and the basics of graphs.",
    difficulty: "Intermediate", hours: 10, skill: "Algorithms", prereqs: ["dsa-structures"],
    objectives: ["Write DFS and BFS from memory", "Turn recursion into iteration"],
    concepts: ["Recursion", "Binary trees and BSTs", "DFS and BFS", "Heaps"],
    practice: ["Solve 12 tree problems including two level-order traversals"],
    criteria: ["You can explain the call stack for a recursive solution"],
    resources: [NEETCODE, LEETCODE],
  },
  "sql-core": {
    id: "sql-core", title: "SQL fundamentals", summary: "Select, filter, join and aggregate relational data.",
    difficulty: "Beginner", hours: 6, skill: "SQL",
    objectives: ["Write joins across three tables", "Aggregate with GROUP BY and HAVING"],
    concepts: ["SELECT and WHERE", "Joins", "GROUP BY", "Subqueries"],
    practice: ["Complete all SQLBolt lessons"],
    criteria: ["You can write a multi-table report query without help"],
    resources: [R("Practice", "SQLBolt interactive lessons", "sqlbolt.com", "https://sqlbolt.com"), R("Read", "PostgreSQL tutorial", "postgresql.org", "https://www.postgresql.org/docs/current/tutorial.html")],
  },
  "sql-advanced": {
    id: "sql-advanced", title: "Indexes, transactions & query tuning", summary: "Make queries fast and data changes safe.",
    difficulty: "Intermediate", hours: 6, skill: "SQL", prereqs: ["sql-core"],
    objectives: ["Read an EXPLAIN plan", "Choose the right index", "Use transactions correctly"],
    concepts: ["B-tree indexes", "EXPLAIN ANALYZE", "Transactions and isolation", "Window functions"],
    practice: ["Speed up a slow query on a 100k-row table and document the change"],
    criteria: ["Measured before/after timings"],
    resources: [R("Read", "Indexes", "postgresql.org", "https://www.postgresql.org/docs/current/indexes.html"), R("Read", "Using EXPLAIN", "postgresql.org", "https://www.postgresql.org/docs/current/using-explain.html")],
  },
  "docker": {
    id: "docker", title: "Docker fundamentals", summary: "Package and run applications in containers.",
    difficulty: "Intermediate", hours: 5, skill: "Docker",
    objectives: ["Understand containers and images", "Write a Dockerfile", "Run an app inside a container"],
    concepts: ["Images vs containers", "Dockerfile instructions", "Ports and volumes", "docker compose"],
    practice: ["Containerize one of your backend services"],
    project: "Run your app and its database together with docker compose.",
    criteria: ["Build the image", "Start the container", "Verify the application endpoint responds"],
    resources: [R("Read", "Get started", "Docker Docs", "https://docs.docker.com/get-started/")],
  },
  "ci-cd": {
    id: "ci-cd", title: "CI/CD pipelines", summary: "Automate tests and deployments on every push.",
    difficulty: "Intermediate", hours: 4, skill: "CI/CD", prereqs: ["git-basics"],
    objectives: ["Run tests automatically on pull requests", "Deploy from the main branch"],
    concepts: ["Workflows and jobs", "Caching dependencies", "Secrets", "Deployment environments"],
    practice: ["Add a workflow that lints and tests your project"],
    criteria: ["A failing test blocks the pull request"],
    resources: [R("Read", "GitHub Actions docs", "GitHub", "https://docs.github.com/en/actions")],
  },
  "cloud": {
    id: "cloud", title: "Cloud fundamentals", summary: "Compute, storage, networking and IAM basics.",
    difficulty: "Intermediate", hours: 6, skill: "AWS", prereqs: ["docker"],
    objectives: ["Explain core cloud services", "Deploy one service with least-privilege access"],
    concepts: ["Compute options", "Object storage", "Managed databases", "IAM roles"],
    practice: ["Deploy a container to a managed service on a free tier"],
    criteria: ["Service is reachable over HTTPS", "No root credentials are used"],
    resources: [R("Read", "Getting started", "AWS", "https://aws.amazon.com/getting-started/")],
  },
  "system-design": {
    id: "system-design", title: "System design basics", summary: "Scale, caching, queues and trade-offs.",
    difficulty: "Advanced", hours: 10, skill: "System Design",
    objectives: ["Sketch a scalable architecture", "Discuss trade-offs clearly"],
    concepts: ["Load balancing", "Caching", "Databases and sharding", "Message queues"],
    practice: ["Design a URL shortener and explain your choices out loud"],
    criteria: ["You can defend at least two trade-offs in your design"],
    resources: [SD_PRIMER],
  },
  // ---------- Java ----------
  "java-core": {
    id: "java-core", title: "Java fundamentals", summary: "Syntax, types, control flow and the JVM.",
    difficulty: "Beginner", hours: 8, skill: "Java",
    objectives: ["Write and run Java programs", "Understand primitive vs reference types"],
    concepts: ["Types and operators", "Control flow", "Methods", "Packages and the JVM"],
    practice: ["Build a command-line expense tracker"],
    criteria: ["Program compiles and handles invalid input"],
    resources: [R("Read", "Learn Java", "dev.java", "https://dev.java/learn/")],
  },
  "java-oop": {
    id: "java-oop", title: "Object-oriented programming", summary: "Classes, interfaces, inheritance and composition.",
    difficulty: "Beginner", hours: 6, skill: "Java", prereqs: ["java-core"],
    objectives: ["Model a domain with classes and interfaces", "Prefer composition where it fits"],
    concepts: ["Encapsulation", "Inheritance", "Polymorphism", "Interfaces and abstract classes"],
    practice: ["Model a library system with books, members and loans"],
    criteria: ["You can explain each of the four OOP principles with your own code"],
    resources: [R("Read", "Object-oriented programming concepts", "Oracle", "https://docs.oracle.com/javase/tutorial/java/concepts/")],
  },
  "java-collections": {
    id: "java-collections", title: "Java Collections", summary: "Lists, sets, maps and when to use each.",
    difficulty: "Intermediate", hours: 5, skill: "Java", prereqs: ["java-oop"],
    objectives: ["Choose the right collection", "Use streams for transformations"],
    concepts: ["List, Set, Map", "equals and hashCode", "Iterators", "Streams API"],
    practice: ["Rewrite the library system lookups using maps and streams"],
    criteria: ["You can explain HashMap vs TreeMap"],
    resources: [R("Read", "Collections trail", "Oracle", "https://docs.oracle.com/javase/tutorial/collections/")],
  },
  "java-exceptions": {
    id: "java-exceptions", title: "Exception handling", summary: "Checked vs unchecked exceptions and clean error paths.",
    difficulty: "Beginner", hours: 3, skill: "Java", prereqs: ["java-oop"],
    objectives: ["Handle and propagate errors deliberately"],
    concepts: ["try/catch/finally", "Checked vs unchecked", "Custom exceptions", "try-with-resources"],
    practice: ["Add validation errors to the expense tracker"],
    criteria: ["No swallowed exceptions in your code"],
    resources: [R("Read", "Exceptions lesson", "Oracle", "https://docs.oracle.com/javase/tutorial/essential/exceptions/")],
  },
  "spring-rest": {
    id: "spring-rest", title: "Spring Boot REST APIs", summary: "Build REST endpoints, validate requests and handle responses.",
    difficulty: "Intermediate", hours: 8, skill: "Spring Boot", prereqs: ["java-collections", "java-exceptions"],
    objectives: ["Create controllers and services", "Validate input and return proper status codes"],
    concepts: ["Controllers", "Dependency injection", "Validation", "Error handlers"],
    practice: ["Build a CRUD API for tasks"],
    criteria: ["Endpoints return correct status codes", "Invalid input returns 400 with a message"],
    resources: [R("Read", "Building a RESTful web service", "spring.io", "https://spring.io/guides/gs/rest-service/")],
  },
  "spring-jpa": {
    id: "spring-jpa", title: "Spring Data JPA & Hibernate", summary: "Map entities and query a relational database.",
    difficulty: "Intermediate", hours: 6, skill: "Spring Boot", prereqs: ["spring-rest", "sql-core"],
    objectives: ["Map entities and relationships", "Avoid N+1 queries"],
    concepts: ["Entities and repositories", "Relationships", "Lazy vs eager loading", "Migrations"],
    practice: ["Persist the tasks API in PostgreSQL"],
    criteria: ["Data survives restart", "You can explain the N+1 problem"],
    resources: [R("Read", "Accessing data with JPA", "spring.io", "https://spring.io/guides/gs/accessing-data-jpa/")],
  },
  "spring-security": {
    id: "spring-security", title: "Spring Security", summary: "Authentication and authorization for your APIs.",
    difficulty: "Advanced", hours: 6, skill: "Spring Boot", prereqs: ["spring-jpa"],
    objectives: ["Protect endpoints", "Implement role-based access"],
    concepts: ["Filter chain", "Password hashing", "JWT basics", "Method security"],
    practice: ["Add login and role checks to the tasks API"],
    criteria: ["Unauthenticated requests are rejected", "Users can only see their own tasks"],
    resources: [R("Read", "Securing a web application", "spring.io", "https://spring.io/guides/gs/securing-web/")],
  },
  // ---------- Node / Python backend ----------
  "node-core": {
    id: "node-core", title: "Node.js services", summary: "Build HTTP services with Node.js.",
    difficulty: "Intermediate", hours: 8, skill: "Node.js", prereqs: ["js-core"],
    objectives: ["Build a REST service", "Structure routes, services and data access"],
    concepts: ["Modules and npm", "HTTP servers", "Middleware", "Environment config"],
    practice: ["Build a notes API with validation"],
    criteria: ["API handles invalid input with 400 responses"],
    resources: [R("Read", "Learn Node.js", "nodejs.org", "https://nodejs.org/en/learn")],
  },
  "py-core": {
    id: "py-core", title: "Python fundamentals", summary: "Syntax, data structures, functions and modules.",
    difficulty: "Beginner", hours: 8, skill: "Python",
    objectives: ["Write idiomatic Python", "Use lists, dicts and comprehensions"],
    concepts: ["Types and control flow", "Functions", "Lists, dicts, sets", "Modules and virtual environments"],
    practice: ["Write a script that cleans and summarises a CSV file"],
    criteria: ["Script runs end to end on new data"],
    resources: [R("Read", "The Python Tutorial", "python.org", "https://docs.python.org/3/tutorial/")],
  },
  "py-oop": {
    id: "py-oop", title: "Python OOP & testing", summary: "Classes, dataclasses and pytest.",
    difficulty: "Intermediate", hours: 6, skill: "Python", prereqs: ["py-core"],
    objectives: ["Structure code with classes", "Write unit tests"],
    concepts: ["Classes and dataclasses", "Exceptions", "pytest fixtures", "Type hints"],
    practice: ["Refactor your CSV script into a tested module"],
    criteria: ["Tests pass and cover the main paths"],
    resources: [R("Read", "Classes", "python.org", "https://docs.python.org/3/tutorial/classes.html"), R("Read", "pytest docs", "pytest.org", "https://docs.pytest.org/")],
  },
  "fastapi": {
    id: "fastapi", title: "FastAPI REST services", summary: "Typed APIs with validation and auto-generated docs.",
    difficulty: "Intermediate", hours: 8, skill: "REST APIs", prereqs: ["py-oop", "sql-core"],
    objectives: ["Build validated endpoints", "Connect to a database"],
    concepts: ["Path and query params", "Pydantic models", "Dependencies", "Database sessions"],
    practice: ["Build a bookmarks API backed by PostgreSQL"],
    criteria: ["Docs page lists all endpoints", "Invalid input returns 422"],
    resources: [R("Read", "FastAPI tutorial", "fastapi.tiangolo.com", "https://fastapi.tiangolo.com/tutorial/")],
  },
  // ---------- Data ----------
  "pandas": {
    id: "pandas", title: "Data wrangling with pandas", summary: "Clean, reshape and join tabular data.",
    difficulty: "Intermediate", hours: 8, skill: "Python", prereqs: ["py-core"],
    objectives: ["Load and clean messy data", "Group, pivot and merge"],
    concepts: ["DataFrames", "Missing values", "groupby", "merge and pivot"],
    practice: ["Clean a public dataset and produce three summary tables"],
    criteria: ["Notebook runs top to bottom without errors"],
    resources: [R("Read", "Getting started", "pandas", "https://pandas.pydata.org/docs/getting_started/index.html")],
  },
  "stats": {
    id: "stats", title: "Statistics for analysis", summary: "Distributions, sampling and hypothesis tests.",
    difficulty: "Intermediate", hours: 10, skill: "Statistics",
    objectives: ["Choose the right summary statistic", "Run and interpret an A/B test"],
    concepts: ["Descriptive statistics", "Distributions", "Confidence intervals", "Hypothesis testing"],
    practice: ["Analyse a sample A/B test and write a one-paragraph recommendation"],
    criteria: ["You can explain a p-value in plain language"],
    resources: [R("Watch", "Statistics and probability", "Khan Academy", "https://www.khanacademy.org/math/statistics-probability")],
  },
  "dashboards": {
    id: "dashboards", title: "Dashboards & storytelling", summary: "Turn analysis into decisions people can act on.",
    difficulty: "Intermediate", hours: 6, skill: "Dashboards", prereqs: ["sql-core"],
    objectives: ["Pick the right chart", "Design a dashboard around one question"],
    concepts: ["Chart selection", "KPIs", "Filters and drill-downs", "Narrative"],
    practice: ["Build a dashboard for a sample sales dataset"],
    criteria: ["A reviewer can answer the main question in under a minute"],
    resources: [R("Read", "Power BI training", "Microsoft Learn", "https://learn.microsoft.com/en-us/training/powerplatform/power-bi")],
  },
  "spark": {
    id: "spark", title: "Distributed processing with Spark", summary: "Process large datasets in parallel.",
    difficulty: "Advanced", hours: 10, skill: "Spark", prereqs: ["pandas"],
    objectives: ["Write DataFrame transformations", "Understand partitions and shuffles"],
    concepts: ["RDDs vs DataFrames", "Lazy evaluation", "Partitioning", "Spark SQL"],
    practice: ["Aggregate a multi-GB public dataset locally"],
    criteria: ["Job completes and you can explain its stages"],
    resources: [R("Read", "Quick start", "Apache Spark", "https://spark.apache.org/docs/latest/quick-start.html")],
  },
  "airflow": {
    id: "airflow", title: "Pipeline orchestration", summary: "Schedule and monitor data pipelines.",
    difficulty: "Advanced", hours: 8, skill: "Airflow", prereqs: ["py-oop"],
    objectives: ["Build a DAG with retries", "Handle backfills"],
    concepts: ["DAGs and tasks", "Scheduling", "Retries and SLAs", "Idempotency"],
    practice: ["Schedule a daily extract-load job"],
    criteria: ["Re-running a day does not duplicate data"],
    resources: [R("Read", "Airflow tutorial", "Apache Airflow", "https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html")],
  },
  "dbt": {
    id: "dbt", title: "Data modelling with dbt", summary: "Version-controlled, tested SQL transformations.",
    difficulty: "Intermediate", hours: 6, skill: "SQL", prereqs: ["sql-advanced"],
    objectives: ["Build staging and mart models", "Add data tests"],
    concepts: ["Models and refs", "Sources", "Tests", "Documentation"],
    practice: ["Model a raw orders dataset into a clean mart"],
    criteria: ["dbt build passes with tests"],
    resources: [R("Read", "What is dbt?", "dbt docs", "https://docs.getdbt.com/docs/introduction")],
  },
};

// Role-specific project & interview activities are generated so titles match the role.
function roleExtras(role: string, key: string, projectSkills: string[]): [Activity, Activity, Activity] {
  return [
    {
      id: `${key}-project`, title: `Build a portfolio project for ${role}`, summary: "One polished, deployed project that shows the skills this role needs.",
      difficulty: "Advanced", hours: 16,
      objectives: ["Ship an end-to-end project", "Document decisions in a README"],
      concepts: projectSkills, practice: ["Write a short spec before you start"],
      project: "Include authentication, persistent data, tests and a public deployment where it fits the role.",
      criteria: ["Project is deployed or runnable from the README", "README explains what you built and why"], resources: [],
    },
    {
      id: `${key}-interview-tech`, title: "Technical interview practice", summary: "Timed problem solving and explaining your thinking out loud.",
      difficulty: "Intermediate", hours: 6,
      objectives: ["Solve problems under time pressure", "Communicate your approach"],
      concepts: ["Clarifying questions", "Talking through trade-offs", "Testing your solution"],
      practice: ["Do five timed problems and review each one"], criteria: ["You finish a medium problem in 30 minutes"],
      resources: [LEETCODE],
    },
    {
      id: `${key}-interview-mock`, title: "Mock interviews & project walkthrough", summary: "Practise explaining your project and run two mock interviews.",
      difficulty: "Intermediate", hours: 4, prereqs: [`${key}-project`],
      objectives: ["Explain your project in two minutes", "Handle follow-up questions"],
      concepts: ["STAR answers", "Project deep-dive", "Questions for the interviewer"],
      practice: ["Record a two-minute project walkthrough"], criteria: ["Two mock interviews completed with notes on what to improve"],
      resources: [],
    },
  ];
}

function role(roleName: string, key: string, phases: Omit<Phase, "id">[], projectSkills: string[]): RoleRoadmap {
  const extras = roleExtras(roleName, key, projectSkills);
  for (const a of extras) ACTIVITIES[a.id] = a;
  return {
    role: roleName,
    phases: [
      ...phases.map((p, i) => ({ ...p, id: `${key}-p${i + 1}` })),
      { id: `${key}-proj`, title: "Projects", description: "Prove your skills with a project you can show and explain.", activities: [extras[0].id] },
      { id: `${key}-int`, title: "Interview Preparation", description: "Turn what you learned into confident interview answers.", activities: [extras[1].id, extras[2].id] },
    ],
  };
}

export const ROLE_ROADMAPS: RoleRoadmap[] = [
  role("Frontend Engineer", "fe", [
    { title: "Foundations", description: "Solid JavaScript, TypeScript and version control.", activities: ["js-core", "ts-core", "git-basics"] },
    { title: "Core Frontend", description: "Build accessible React interfaces that talk to real APIs.", activities: ["react-core", "react-api", "a11y"] },
    { title: "Quality & Architecture", description: "Testing and system design for production frontends.", activities: ["fe-testing", "fe-sd", "ci-cd"] },
  ], ["React", "TypeScript", "Testing", "Accessibility"]),
  role("Java Full Stack Developer", "jfs", [
    { title: "Foundations", description: "Core Java, OOP, collections and error handling.", activities: ["java-core", "java-oop", "java-collections", "java-exceptions"] },
    { title: "Data Structures & Algorithms", description: "The problem-solving patterns interviewers expect.", activities: ["dsa-arrays", "dsa-structures", "dsa-trees"] },
    { title: "Backend Development", description: "Master Spring Boot and build secure REST APIs.", activities: ["spring-rest", "spring-jpa", "spring-security"] },
    { title: "Databases", description: "Relational modelling, indexes and transactions.", activities: ["sql-core", "sql-advanced"] },
    { title: "Frontend Development", description: "JavaScript and React for the client side.", activities: ["js-core", "react-core", "react-api"] },
    { title: "Engineering Tools", description: "Ship code like a team: Git, containers, pipelines and cloud.", activities: ["git-basics", "docker", "ci-cd", "cloud"] },
  ], ["Spring Boot", "React", "PostgreSQL", "Docker"]),
  role("Backend Developer", "be", [
    { title: "Foundations", description: "Language fluency, Git and core data structures.", activities: ["js-core", "git-basics", "dsa-arrays", "dsa-structures"] },
    { title: "Backend Development", description: "Design and build reliable HTTP services.", activities: ["node-core", "sql-core", "sql-advanced"] },
    { title: "Engineering Tools", description: "Containers, pipelines and cloud deployment.", activities: ["docker", "ci-cd", "cloud"] },
    { title: "Architecture", description: "Scale and trade-offs for backend systems.", activities: ["system-design"] },
  ], ["REST APIs", "SQL", "Docker", "System Design"]),
  role("Python Developer", "py", [
    { title: "Foundations", description: "Idiomatic Python, testing and Git.", activities: ["py-core", "py-oop", "git-basics"] },
    { title: "Data Structures & Algorithms", description: "Problem-solving patterns in Python.", activities: ["dsa-arrays", "dsa-structures", "dsa-trees"] },
    { title: "Backend Development", description: "Typed REST services with a real database.", activities: ["sql-core", "fastapi"] },
    { title: "Engineering Tools", description: "Package, test and deploy your services.", activities: ["docker", "ci-cd"] },
  ], ["Python", "FastAPI", "SQL", "Testing"]),
  role("Data Analyst", "da", [
    { title: "Foundations", description: "SQL and Python for working with data.", activities: ["sql-core", "py-core"] },
    { title: "Analysis", description: "Clean data and draw sound conclusions.", activities: ["pandas", "stats", "sql-advanced"] },
    { title: "Communication", description: "Dashboards and stories that drive decisions.", activities: ["dashboards"] },
  ], ["SQL", "Python", "Statistics", "Dashboards"]),
  role("Data Engineer", "de", [
    { title: "Foundations", description: "Python, SQL and version control.", activities: ["py-core", "py-oop", "sql-core", "git-basics"] },
    { title: "Data Modelling", description: "Performant, tested transformations.", activities: ["sql-advanced", "dbt"] },
    { title: "Pipelines", description: "Process and orchestrate data at scale.", activities: ["pandas", "spark", "airflow"] },
    { title: "Engineering Tools", description: "Containers, CI and cloud infrastructure.", activities: ["docker", "ci-cd", "cloud"] },
  ], ["SQL", "Spark", "Airflow", "Cloud"]),
];

export const ROLE_NAMES = ROLE_ROADMAPS.map((r) => r.role);

export function findRoadmap(role: string | null | undefined): RoleRoadmap | null {
  if (!role) return null;
  const r = role.trim().toLowerCase();
  return ROLE_ROADMAPS.find((x) => x.role.toLowerCase() === r)
    ?? ROLE_ROADMAPS.find((x) => r.includes(x.role.toLowerCase()) || x.role.toLowerCase().includes(r))
    ?? null;
}
