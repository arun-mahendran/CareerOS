// Real exports: PDF via the browser's print engine (selectable text, live links,
// proper A4 page breaks) and DOCX via the `docx` library (editable in Word).
import { AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { dateRange, displayUrl, SECTION_LABELS, type ResumeData, type TemplateId } from "./model";
import { orderFor, PAGE_MARGIN, RESUME_CSS } from "@/components/resume/resume-document";

const safe = (s: string) => (s || "resume").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");

export function exportPdf(docEl: HTMLElement, template: TemplateId, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const w = frame.contentWindow;
    if (!w) return reject(new Error("Couldn't open the print view"));
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(title)}</title><style>@page{size:A4;margin:${PAGE_MARGIN[template]}}html,body{margin:0;background:#fff}${RESUME_CSS}</style></head><body>${docEl.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        setTimeout(() => frame.remove(), 1000);
      }
    }, 250);
  });
}

const FONT: Record<TemplateId, string> = { ats: "Arial", modern: "Segoe UI", fresher: "Calibri", minimal: "Georgia" };
const ACCENT: Record<TemplateId, string> = { ats: "111521", modern: "2B3A8F", fresher: "111521", minimal: "555C6E" };

export async function exportDocx(d: ResumeData, template: TemplateId, title: string) {
  const accent = ACCENT[template];
  const center = template === "fresher";
  const RIGHT = 9600;
  const link = (url: string, text: string) => new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: "Hyperlink" })] });
  const heading = (t: string) => new Paragraph({
    spacing: { before: 220, after: 80 }, keepNext: true,
    ...(template === "minimal" ? {} : { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } } }),
    children: [new TextRun({ text: template === "modern" ? t : t.toUpperCase(), bold: template !== "minimal", color: accent, size: 21 })],
  });
  const row = (left: TextRun[], right: string) => new Paragraph({
    spacing: { before: 100 }, keepNext: true, tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
    children: [...left, ...(right ? [new TextRun({ text: `\t${right}`, color: "555C6E", size: 18 })] : [])],
  });
  const sub = (t: string) => new Paragraph({ children: [new TextRun({ text: t, italics: true, color: "3A4152" })] });
  const bullets = (xs: string[]) => xs.map((b) => b.trim()).filter(Boolean).map((b) => new Paragraph({ text: b, bullet: { level: 0 } }));

  const p = d.personal;
  const contacts: (TextRun | ExternalHyperlink)[] = [];
  const add = (n: TextRun | ExternalHyperlink) => { if (contacts.length) contacts.push(new TextRun({ text: "  ·  ", color: "8A90A0" })); contacts.push(n); };
  if (p.email) add(link(`mailto:${p.email}`, p.email));
  if (p.phone) add(new TextRun(p.phone));
  if (p.location) add(new TextRun(p.location));
  for (const u of [p.linkedin, p.github, p.portfolio]) if (u) add(link(u, displayUrl(u)));

  const body: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: p.name || "Your Name", bold: template !== "minimal", size: 40, color: template === "modern" ? accent : "111521" })] }),
  ];
  if (p.title) body.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: p.title, size: 22, color: "3A4152" })] }));
  if (contacts.length) body.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 80 }, children: contacts }));

  for (const k of orderFor(d, template)) {
    const part: Paragraph[] = [];
    if (k === "summary" && d.summary.trim()) part.push(new Paragraph({ text: d.summary.trim() }));
    if (k === "experience") for (const e of d.experience.filter((x) => (x.title || x.company) && !(d.exclude ?? []).includes(x.id))) {
      part.push(row([new TextRun({ text: `${e.title}${e.company ? `, ${e.company}` : ""}`, bold: true })], dateRange(e.start, e.end, e.current)));
      if (e.type || e.location) part.push(sub([e.type, e.location].filter(Boolean).join(" · ")));
      part.push(...bullets([...e.bullets, ...e.achievements]));
    }
    if (k === "projects") for (const x of d.projects.filter((y) => y.name && !(d.exclude ?? []).includes(y.id))) {
      part.push(row([new TextRun({ text: x.name, bold: true })], ""));
      const links = [x.repo && link(x.repo, "Code"), x.demo && link(x.demo, "Live demo")].filter(Boolean) as ExternalHyperlink[];
      if (x.tech) part.push(sub(x.tech));
      if (links.length) part.push(new Paragraph({ children: links.flatMap((l, i) => (i ? [new TextRun("  ·  "), l] : [l])) }));
      if (x.description) part.push(new Paragraph({ text: x.description }));
      part.push(...bullets(x.bullets));
    }
    if (k === "skills") for (const g of d.skills.filter((y) => y.skills.length)) part.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: `${g.category}: `, bold: true }), new TextRun(g.skills.join(", "))] }));
    if (k === "education") for (const e of d.education.filter((x) => x.degree || x.institution)) {
      part.push(row([new TextRun({ text: [e.degree, e.field].filter(Boolean).join(", "), bold: true })], [e.start, e.end].filter(Boolean).join(" – ")));
      part.push(sub([e.institution, e.grade].filter(Boolean).join(" · ")));
    }
    if (k === "certifications") for (const c of d.certifications.filter((x) => x.name)) part.push(row([new TextRun({ text: c.name, bold: true }), new TextRun(c.issuer ? ` — ${c.issuer}` : "")], c.date));
    if (k === "achievements") for (const a of d.achievements.filter((x) => x.title)) {
      part.push(row([new TextRun({ text: a.title, bold: true }), new TextRun(a.issuer ? ` — ${a.issuer}` : "")], a.date));
      if (a.description) part.push(new Paragraph({ text: a.description }));
    }
    if (part.length) body.push(heading(SECTION_LABELS[k]), ...part);
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT[template], size: 20, color: "1F2430" } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 794, bottom: 794, left: 907, right: 907 } } }, children: body }],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safe(title)}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
