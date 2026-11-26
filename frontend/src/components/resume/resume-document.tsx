// The resume as a printable document. The same markup + CSS is used for the
// live preview and for PDF export, so what you see is what downloads.
import type { ReactNode } from "react";
import { dateRange, displayUrl, SECTION_LABELS, type ResumeData, type SectionKey, type TemplateId } from "@/lib/resume/model";

// Document styles are fixed (paper is always white, ink is always dark) so the
// exported file looks identical regardless of the app's light/dark theme.
export const RESUME_CSS = `
.rd{box-sizing:border-box;width:210mm;min-height:297mm;background:#fff;color:#1f2430;padding:14mm 16mm;font:10pt/1.42 Arial,Helvetica,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
.rd *{box-sizing:border-box;margin:0;padding:0}
.rd a{color:inherit;text-decoration:none}
.rd h1{font-size:20pt;line-height:1.15;font-weight:700;color:#111521}
.rd .rd-title{font-size:11pt;color:#3a4152;margin-top:2pt}
.rd .rd-contact{margin-top:5pt;font-size:9pt;color:#4a5163;display:flex;flex-wrap:wrap;gap:2pt 10pt}
.rd section{margin-top:11pt}
.rd h2{font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#111521;border-bottom:1px solid #c9ced8;padding-bottom:2pt;margin-bottom:5pt;break-after:avoid;page-break-after:avoid}
.rd .rd-item{margin-top:6pt;break-inside:avoid;page-break-inside:avoid}
.rd .rd-row{display:flex;justify-content:space-between;gap:10pt;align-items:baseline}
.rd .rd-strong{font-weight:700;color:#111521}
.rd .rd-muted{color:#555c6e;font-size:9pt;white-space:nowrap}
.rd .rd-sub{color:#3a4152;font-style:italic}
.rd ul{margin:2pt 0 0 13pt}
.rd li{margin-top:1.5pt}
.rd .rd-skill{margin-top:2pt}
.rd .rd-skill b{color:#111521}
.rd p{margin-top:2pt}
.rd[data-t=modern]{font-family:"Segoe UI",Helvetica,Arial,sans-serif}
.rd[data-t=modern] h1{color:#2b3a8f}
.rd[data-t=modern] h2{color:#2b3a8f;border-bottom:2px solid #2b3a8f;text-transform:none;letter-spacing:0;font-size:11.5pt}
.rd[data-t=modern] a{color:#2b3a8f}
.rd[data-t=fresher]{font-family:Calibri,Carlito,Arial,sans-serif;font-size:10.5pt}
.rd[data-t=fresher] header{text-align:center}
.rd[data-t=fresher] .rd-contact{justify-content:center}
.rd[data-t=fresher] h2{background:#eef1f6;border:0;padding:2pt 5pt}
.rd[data-t=minimal]{font-family:Georgia,"Times New Roman",serif;font-size:10pt;padding:18mm 20mm}
.rd[data-t=minimal] h1{font-weight:400;font-size:22pt;letter-spacing:.01em}
.rd[data-t=minimal] h2{font-weight:400;border:0;letter-spacing:.14em;font-size:9pt;color:#555c6e;margin-bottom:3pt}
.rd[data-t=minimal] section{margin-top:14pt}
@media print{.rd{width:auto;min-height:0;padding:0}}
`;

/** The print page margin per template, matching the preview padding. */
export const PAGE_MARGIN: Record<TemplateId, string> = { ats: "14mm 16mm", modern: "14mm 16mm", fresher: "14mm 16mm", minimal: "18mm 20mm" };

export function orderFor(d: ResumeData, t: TemplateId): SectionKey[] {
  const visible = d.order.filter((k) => !d.hidden.includes(k));
  if (t !== "fresher") return visible;
  const first: SectionKey[] = ["summary", "education", "projects", "skills"];
  return [...first.filter((k) => visible.includes(k)), ...visible.filter((k) => !first.includes(k))];
}

const Bullets = ({ items }: { items: string[] }) => {
  const xs = items.map((b) => b.trim()).filter(Boolean);
  return xs.length ? <ul>{xs.map((b, i) => <li key={i}>{b}</li>)}</ul> : null;
};

const Link = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>;

export function ResumeDocument({ data: d, template }: { data: ResumeData; template: TemplateId }) {
  const ex = new Set(d.exclude ?? []);
  const p = d.personal;
  const contact = [
    p.email && <Link key="e" href={`mailto:${p.email}`}>{p.email}</Link>,
    p.phone && <span key="p">{p.phone}</span>,
    p.location && <span key="l">{p.location}</span>,
    p.linkedin && <Link key="li" href={p.linkedin}>{displayUrl(p.linkedin)}</Link>,
    p.github && <Link key="gh" href={p.github}>{displayUrl(p.github)}</Link>,
    p.portfolio && <Link key="pf" href={p.portfolio}>{displayUrl(p.portfolio)}</Link>,
  ].filter(Boolean);

  const sections: Record<SectionKey, ReactNode> = {
    summary: d.summary.trim() && <p>{d.summary.trim()}</p>,
    experience: d.experience.filter((e) => (e.title || e.company) && !ex.has(e.id)).map((e) => (
      <div key={e.id} className="rd-item">
        <div className="rd-row"><span className="rd-strong">{e.title}{e.company && `, ${e.company}`}</span><span className="rd-muted">{dateRange(e.start, e.end, e.current)}</span></div>
        {(e.type || e.location) && <div className="rd-sub">{[e.type, e.location].filter(Boolean).join(" · ")}</div>}
        <Bullets items={[...e.bullets, ...e.achievements]} />
      </div>
    )),
    projects: d.projects.filter((x) => x.name && !ex.has(x.id)).map((x) => (
      <div key={x.id} className="rd-item">
        <div className="rd-row">
          <span className="rd-strong">{x.name}</span>
          <span className="rd-muted">{[x.repo && <Link key="r" href={x.repo}>Code</Link>, x.demo && <Link key="d" href={x.demo}>Live</Link>].filter(Boolean).reduce<ReactNode[]>((a, n, i) => (i ? [...a, " · ", n] : [n]), [])}</span>
        </div>
        {x.tech && <div className="rd-sub">{x.tech}</div>}
        {x.description && <p>{x.description}</p>}
        <Bullets items={x.bullets} />
      </div>
    )),
    skills: d.skills.filter((g) => g.skills.length).map((g) => (
      <div key={g.id} className="rd-skill"><b>{g.category}:</b> {g.skills.join(", ")}</div>
    )),
    education: d.education.filter((e) => e.degree || e.institution).map((e) => (
      <div key={e.id} className="rd-item">
        <div className="rd-row"><span className="rd-strong">{[e.degree, e.field].filter(Boolean).join(", ")}</span><span className="rd-muted">{[e.start, e.end].filter(Boolean).join(" – ")}</span></div>
        <div className="rd-sub">{[e.institution, e.grade].filter(Boolean).join(" · ")}</div>
      </div>
    )),
    certifications: d.certifications.filter((c) => c.name).map((c) => (
      <div key={c.id} className="rd-item rd-row">
        <span><span className="rd-strong">{c.url ? <Link href={c.url}>{c.name}</Link> : c.name}</span>{c.issuer && ` — ${c.issuer}`}</span>
        <span className="rd-muted">{c.date}</span>
      </div>
    )),
    achievements: d.achievements.filter((a) => a.title).map((a) => (
      <div key={a.id} className="rd-item">
        <div className="rd-row"><span><span className="rd-strong">{a.title}</span>{a.issuer && ` — ${a.issuer}`}</span><span className="rd-muted">{a.date}</span></div>
        {a.description && <p>{a.description}</p>}
      </div>
    )),
  };

  return (
    <article className="rd" data-t={template}>
      <header>
        <h1>{p.name || "Your Name"}</h1>
        {p.title && <div className="rd-title">{p.title}</div>}
        {contact.length > 0 && <div className="rd-contact">{contact}</div>}
      </header>
      {orderFor(d, template).map((k) => {
        const body = sections[k];
        if (!body || (Array.isArray(body) && body.length === 0)) return null;
        return <section key={k}><h2>{SECTION_LABELS[k]}</h2>{body}</section>;
      })}
    </article>
  );
}
