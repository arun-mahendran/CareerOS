import { useState } from "react";
import { Award, BadgeCheck, Briefcase, Eye, EyeOff, FolderGit2, GraduationCap, Link2, User, Wrench, AlignLeft, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { blank, move, OPTIONAL_SECTIONS, SECTION_LABELS, sectionDone, SKILL_CATEGORIES, uid, type ResumeData, type SectionKey } from "@/lib/resume/model";
import { AddBtn, Area, BulletEditor, EntryCard, Field, IconBtn, ImproveButton, inputCls, MoveBtns, SectionCard, TagInput } from "./fields";

type Set = (fn: (d: ResumeData) => ResumeData) => void;
type Key = SectionKey | "personal" | "links";

export const STEP_SECTIONS: Key[][] = [
  ["personal", "summary", "links"],
  ["experience", "projects"],
  ["skills", "education", "certifications", "achievements"],
];

const ICONS = { personal: User, summary: AlignLeft, links: Link2, experience: Briefcase, projects: FolderGit2, skills: Wrench, education: GraduationCap, certifications: BadgeCheck, achievements: Award };
const TITLES: Record<Key, string> = { ...SECTION_LABELS, experience: "Work experience / internships", personal: "Personal information", links: "Social links & portfolio" };

const ROLE_HINTS: Record<string, string> = {
  frontend: "Mention the UI frameworks you've used and something you built and shipped.",
  backend: "Mention languages, APIs or databases you've worked with and a system you built.",
  data: "Mention the tools you analyse data with and a question you answered with it.",
};

export function Editor({ data: d, set, step, role }: { data: ResumeData; set: Set; step: number; role: string }) {
  const keys = STEP_SECTIONS[step] ?? [];
  const [open, setOpen] = useState<Key | null>(keys[0] ?? null);
  const done = sectionDone(d);
  const toggle = (k: Key) => setOpen(open === k ? null : k);
  const visible = keys.filter((k) => !(OPTIONAL_SECTIONS as Key[]).includes(k) || !d.hidden.includes(k as SectionKey));
  const addable = keys.filter((k) => (OPTIONAL_SECTIONS as Key[]).includes(k) && d.hidden.includes(k as SectionKey)) as SectionKey[];
  const p = d.personal;
  const setP = (k: keyof ResumeData["personal"]) => (v: string) => set((x) => ({ ...x, personal: { ...x.personal, [k]: v } }));
  const hint = Object.entries(ROLE_HINTS).find(([k]) => role.toLowerCase().includes(k))?.[1] ?? "Say who you are, what you work with, and the kind of role you want.";
  const hide = (k: SectionKey) => set((x) => ({ ...x, hidden: [...x.hidden, k] }));

  const card = (k: Key, children: React.ReactNode) => (
    <SectionCard key={k} icon={ICONS[k]} title={TITLES[k]} done={done[k]} open={open === k} onToggle={() => toggle(k)}
      actions={(OPTIONAL_SECTIONS as Key[]).includes(k) ? <IconBtn label="Remove section from resume" onClick={() => hide(k as SectionKey)}><EyeOff className="size-3.5" /></IconBtn> : undefined}>
      {children}
    </SectionCard>
  );

  const render: Record<Key, () => React.ReactNode> = {
    personal: () => card("personal", (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" value={p.name} onChange={setP("name")} placeholder="Priya Raman" />
        <Field label="Professional title" value={p.title} onChange={setP("title")} placeholder="Frontend Developer" />
        <Field label="Email" type="email" value={p.email} onChange={setP("email")} placeholder="you@example.com" />
        <Field label="Phone" type="tel" value={p.phone} onChange={setP("phone")} placeholder="+91 98765 43210" />
        <Field label="City, country" value={p.location} onChange={setP("location")} placeholder="Chennai, India" className="sm:col-span-2" optional />
      </div>
    )),
    links: () => card("links", (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="LinkedIn" value={p.linkedin} onChange={setP("linkedin")} placeholder="https://linkedin.com/in/…" optional />
        <Field label="GitHub" value={p.github} onChange={setP("github")} placeholder="https://github.com/…" optional />
        <Field label="Portfolio" value={p.portfolio} onChange={setP("portfolio")} placeholder="https://…" className="sm:col-span-2" optional />
      </div>
    )),
    summary: () => card("summary", (
      <>
        <Area label="Summary" rows={4} max={400} value={d.summary} onChange={(v) => set((x) => ({ ...x, summary: v }))}
          placeholder="2–3 lines: who you are, what you work with, and the role you're aiming for."
          right={<ImproveButton text={d.summary} kind="summary" role={role} onAccept={(v) => set((x) => ({ ...x, summary: v }))} />} />
        <p className="rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">Tip for {role || "your target role"}: {hint}</p>
      </>
    )),
    experience: () => card("experience", (
      <>
        {d.experience.length === 0 && <p className="text-sm text-muted-foreground">No experience yet? That's fine — internships, freelance and part-time work count. Freshers can lean on projects instead.</p>}
        {d.experience.map((e, i) => {
          const up = (patch: Partial<typeof e>) => set((x) => ({ ...x, experience: x.experience.map((y) => (y.id === e.id ? { ...y, ...patch } : y)) }));
          return (
            <EntryCard key={e.id} i={i} n={d.experience.length} defaultOpen={!e.title} title={e.title || "New position"} sub={e.company}
              onMove={(dir) => set((x) => ({ ...x, experience: move(x.experience, i, dir) }))}
              onRemove={() => set((x) => ({ ...x, experience: x.experience.filter((y) => y.id !== e.id) }))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job title" value={e.title} onChange={(v) => up({ title: v })} placeholder="Software Engineering Intern" />
                <Field label="Company" value={e.company} onChange={(v) => up({ company: v })} placeholder="Company name" />
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-foreground/80">Employment type</span>
                  <select value={e.type} onChange={(ev) => up({ type: ev.target.value })} className={inputCls}>
                    {["Internship", "Full-time", "Part-time", "Contract", "Freelance"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <Field label="Location" value={e.location} onChange={(v) => up({ location: v })} placeholder="Bengaluru / Remote" optional />
                <Field label="Start" type="month" value={e.start} onChange={(v) => up({ start: v })} />
                <div>
                  <Field label="End" type="month" value={e.current ? "" : e.end} onChange={(v) => up({ end: v })} />
                  <label className="mt-1.5 flex items-center gap-2 text-xs"><input type="checkbox" checked={e.current} onChange={(ev) => up({ current: ev.target.checked })} /> I currently work here</label>
                </div>
              </div>
              <BulletEditor label="Responsibilities" items={e.bullets} onChange={(v) => up({ bullets: v })} placeholder="Describe the work you performed and the outcome, using only facts you can substantiate." />
              <BulletEditor label="Achievements" items={e.achievements} onChange={(v) => up({ achievements: v })} placeholder="A specific result you can back up, e.g. reduced page load time" />
            </EntryCard>
          );
        })}
        <AddBtn onClick={() => set((x) => ({ ...x, experience: [...x.experience, blank.experience()] }))}>Add experience</AddBtn>
      </>
    )),
    projects: () => card("projects", (
      <>
        {d.projects.length === 0 && <p className="text-sm text-muted-foreground">Projects are often the strongest part of a student resume. Add the ones you'd be happy to talk about in an interview.</p>}
        {d.projects.map((x, i) => {
          const up = (patch: Partial<typeof x>) => set((s) => ({ ...s, projects: s.projects.map((y) => (y.id === x.id ? { ...y, ...patch } : y)) }));
          return (
            <EntryCard key={x.id} i={i} n={d.projects.length} defaultOpen={!x.name} title={x.name || "New project"} sub={x.tech}
              onMove={(dir) => set((s) => ({ ...s, projects: move(s.projects, i, dir) }))}
              onRemove={() => set((s) => ({ ...s, projects: s.projects.filter((y) => y.id !== x.id) }))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Project name" value={x.name} onChange={(v) => up({ name: v })} placeholder="Campus Placement Tracker" />
                <Field label="Technologies used" value={x.tech} onChange={(v) => up({ tech: v })} placeholder="React, Node.js, PostgreSQL" />
                <Field label="GitHub repository" value={x.repo} onChange={(v) => up({ repo: v })} placeholder="https://github.com/…" optional />
                <Field label="Live demo" value={x.demo} onChange={(v) => up({ demo: v })} placeholder="https://…" optional />
              </div>
              <Area label="Short description" rows={2} max={300} value={x.description} onChange={(v) => up({ description: v })} placeholder="What it does and who it's for, in one or two sentences."
                right={<ImproveButton text={x.description} kind="project" role={role} onAccept={(v) => up({ description: v })} />} />
              <BulletEditor label="Highlights" items={x.bullets} onChange={(v) => up({ bullets: v })} placeholder="A feature you built or a problem you solved" />
            </EntryCard>
          );
        })}
        <AddBtn onClick={() => set((s) => ({ ...s, projects: [...s.projects, blank.project()] }))}>Add project</AddBtn>
      </>
    )),
    skills: () => card("skills", (
      <>
        <p className="text-xs text-muted-foreground">List only skills you can discuss confidently. Press Enter or comma to add. Click a skill to move it left.</p>
        {d.skills.map((g, i) => (
          <div key={g.id} className="space-y-1.5">
            <div className="flex items-center gap-1">
              <input value={g.category} onChange={(e) => set((x) => ({ ...x, skills: x.skills.map((y) => (y.id === g.id ? { ...y, category: e.target.value } : y)) }))} className="flex-1 bg-transparent text-xs font-medium outline-none" aria-label="Category name" />
              <MoveBtns i={i} n={d.skills.length} onMove={(dir) => set((x) => ({ ...x, skills: move(x.skills, i, dir) }))} />
              <IconBtn label="Remove category" danger onClick={() => set((x) => ({ ...x, skills: x.skills.filter((y) => y.id !== g.id) }))}><Eye className="hidden" /><span className="text-xs">✕</span></IconBtn>
            </div>
            <TagInput tags={g.skills} placeholder="e.g. Java, Python" onChange={(v) => set((x) => ({ ...x, skills: x.skills.map((y) => (y.id === g.id ? { ...y, skills: v } : y)) }))} />
          </div>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="size-3" /> Add category</button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[...SKILL_CATEGORIES.filter((c) => !d.skills.some((g) => g.category === c)), "Custom category"].map((c) => (
              <DropdownMenuItem key={c} onSelect={() => set((x) => ({ ...x, skills: [...x.skills, { id: uid(), category: c === "Custom category" ? "Other" : c, skills: [] }] }))}>{c}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )),
    education: () => card("education", (
      <>
        {d.education.map((e, i) => {
          const up = (patch: Partial<typeof e>) => set((x) => ({ ...x, education: x.education.map((y) => (y.id === e.id ? { ...y, ...patch } : y)) }));
          return (
            <EntryCard key={e.id} i={i} n={d.education.length} defaultOpen={!e.degree} title={e.degree || "New education"} sub={e.institution}
              onMove={(dir) => set((x) => ({ ...x, education: move(x.education, i, dir) }))}
              onRemove={() => set((x) => ({ ...x, education: x.education.filter((y) => y.id !== e.id) }))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Degree" value={e.degree} onChange={(v) => up({ degree: v })} placeholder="B.E." />
                <Field label="Field of study" value={e.field} onChange={(v) => up({ field: v })} placeholder="Computer Science" />
                <Field label="Institution" value={e.institution} onChange={(v) => up({ institution: v })} placeholder="College / University" className="sm:col-span-2" />
                <Field label="Start year" value={e.start} onChange={(v) => up({ start: v })} placeholder="2022" />
                <Field label="Graduation year" value={e.end} onChange={(v) => up({ end: v })} placeholder="2026" />
                <Field label="CGPA or percentage" value={e.grade} onChange={(v) => up({ grade: v })} placeholder="8.4 CGPA" optional />
              </div>
            </EntryCard>
          );
        })}
        <AddBtn onClick={() => set((x) => ({ ...x, education: [...x.education, blank.education()] }))}>Add education</AddBtn>
      </>
    )),
    certifications: () => card("certifications", (
      <>
        {d.certifications.map((c, i) => {
          const up = (patch: Partial<typeof c>) => set((x) => ({ ...x, certifications: x.certifications.map((y) => (y.id === c.id ? { ...y, ...patch } : y)) }));
          return (
            <EntryCard key={c.id} i={i} n={d.certifications.length} defaultOpen={!c.name} title={c.name || "New certification"} sub={c.issuer}
              onMove={(dir) => set((x) => ({ ...x, certifications: move(x.certifications, i, dir) }))}
              onRemove={() => set((x) => ({ ...x, certifications: x.certifications.filter((y) => y.id !== c.id) }))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Certification name" value={c.name} onChange={(v) => up({ name: v })} />
                <Field label="Issuing organization" value={c.issuer} onChange={(v) => up({ issuer: v })} />
                <Field label="Completion date" value={c.date} onChange={(v) => up({ date: v })} placeholder="Mar 2026" optional />
                <Field label="Credential URL" value={c.url} onChange={(v) => up({ url: v })} placeholder="https://…" optional />
              </div>
            </EntryCard>
          );
        })}
        <AddBtn onClick={() => set((x) => ({ ...x, certifications: [...x.certifications, blank.certification()] }))}>Add certification</AddBtn>
      </>
    )),
    achievements: () => card("achievements", (
      <>
        {d.achievements.map((a, i) => {
          const up = (patch: Partial<typeof a>) => set((x) => ({ ...x, achievements: x.achievements.map((y) => (y.id === a.id ? { ...y, ...patch } : y)) }));
          return (
            <EntryCard key={a.id} i={i} n={d.achievements.length} defaultOpen={!a.title} title={a.title || "New achievement"} sub={a.issuer}
              onMove={(dir) => set((x) => ({ ...x, achievements: move(x.achievements, i, dir) }))}
              onRemove={() => set((x) => ({ ...x, achievements: x.achievements.filter((y) => y.id !== a.id) }))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" value={a.title} onChange={(v) => up({ title: v })} placeholder="Smart India Hackathon finalist" />
                <Field label="Issuing organization" value={a.issuer} onChange={(v) => up({ issuer: v })} optional />
                <Field label="Date" value={a.date} onChange={(v) => up({ date: v })} placeholder="2025" optional />
              </div>
              <Area label="Description" rows={2} value={a.description} onChange={(v) => up({ description: v })} placeholder="One line of context" />
            </EntryCard>
          );
        })}
        <AddBtn onClick={() => set((x) => ({ ...x, achievements: [...x.achievements, blank.achievement()] }))}>Add achievement</AddBtn>
      </>
    )),
  };

  return (
    <div className="space-y-3">
      {visible.map((k) => render[k]())}
      {addable.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"><Plus className="size-4" /> Add section</button></DropdownMenuTrigger>
          <DropdownMenuContent>
            {addable.map((k) => <DropdownMenuItem key={k} onSelect={() => { set((x) => ({ ...x, hidden: x.hidden.filter((h) => h !== k) })); setOpen(k); }}>{SECTION_LABELS[k]}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function SectionOrder({ data: d, set }: { data: ResumeData; set: Set }) {
  const shown = d.order.filter((k) => !d.hidden.includes(k));
  return (
    <ul className="divide-y rounded-lg border">
      {shown.map((k, i) => (
        <li key={k} className="flex items-center gap-1 px-3 py-1.5 text-sm">
          <span className="flex-1">{SECTION_LABELS[k]}</span>
          <MoveBtns i={i} n={shown.length} onMove={(dir) => set((x) => {
            const vis = x.order.filter((o) => !x.hidden.includes(o));
            const next = move(vis, i, dir);
            return { ...x, order: [...next, ...x.order.filter((o) => x.hidden.includes(o))] };
          })} />
        </li>
      ))}
    </ul>
  );
}
