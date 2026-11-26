import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { ResumeData, TemplateId } from "@/lib/resume/model";
import { ResumeDocument, RESUME_CSS } from "./resume-document";

const PAGE_W = 794; // 210mm at 96dpi
const PAGE_H = 1123; // 297mm

/** A4 workspace with zoom, page count and page-boundary markers. */
export const ResumePreview = forwardRef<HTMLDivElement, { data: ResumeData; template: TemplateId }>(function ResumePreview({ data, template }, docRef) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.6);
  const [zoom, setZoom] = useState<number | null>(null);
  const [height, setHeight] = useState(PAGE_H);
  const scale = zoom ?? fit;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.min(1.1, (el.clientWidth - 48) / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = inner.current?.firstElementChild as HTMLElement | null;
    if (el) setHeight(el.scrollHeight);
  });

  // Content area per page (page height minus top+bottom margins) for boundary markers.
  const margin = template === "minimal" ? 68 : 53;
  const perPage = PAGE_H - margin * 2;
  const pages = Math.max(1, Math.ceil((height - margin * 2) / perPage));

  return (
    <div className="flex h-full flex-col rounded-xl border bg-muted/60">
      <div className="flex items-center justify-between gap-2 border-b bg-card/70 px-3 py-2 text-xs">
        <span className="text-muted-foreground">{pages === 1 ? "1 page" : `${pages} pages`} · A4</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.3, scale - 0.1))} className="rounded-md p-1.5 hover:bg-muted"><Minus className="size-3.5" /></button>
          <span className="w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom(Math.min(1.6, scale + 0.1))} className="rounded-md p-1.5 hover:bg-muted"><Plus className="size-3.5" /></button>
          <button type="button" onClick={() => setZoom(null)} className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"><Maximize2 className="size-3" /> Fit</button>
        </div>
      </div>
      <div ref={wrap} className="flex-1 overflow-auto p-6">
        <style>{RESUME_CSS}</style>
        <div className="mx-auto" style={{ width: PAGE_W * scale, height: Math.max(height, PAGE_H) * scale }}>
          <div className="relative origin-top-left shadow-float" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
            <div ref={inner}>
              <div ref={docRef}><ResumeDocument data={data} template={template} /></div>
            </div>
            {Array.from({ length: pages - 1 }, (_, i) => (
              <div key={i} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ top: margin + perPage * (i + 1) }}>
                <span className="h-px flex-1 border-t border-dashed border-primary/40" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Page {i + 2}</span>
                <span className="h-px w-6 border-t border-dashed border-primary/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
