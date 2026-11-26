import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Check, ChevronDown, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { improveWording } from "@/lib/resume/ai.functions";
import { ai, USE_API } from "@/services/backend";
import { cn } from "@/lib/utils";

export const inputCls = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary/40 focus:ring-2 focus:ring-ring/25";

export function Field({ label, value, onChange, placeholder, type = "text", className, optional }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string; optional?: boolean }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">{label}{optional && <span className="font-normal text-muted-foreground">optional</span>}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </label>
  );
}

export function Area({ label, value, onChange, placeholder, rows = 3, max, right }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; max?: number; right?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground/80">
        {label}
        <span className="flex items-center gap-2 font-normal text-muted-foreground">{max && <span className={cn(value.length > max && "text-destructive")}>{value.length}/{max}</span>}{right}</span>
      </span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, "resize-y leading-relaxed")} />
    </label>
  );
}

export function IconBtn({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30", danger && "hover:bg-destructive/10 hover:text-destructive")}>
      {children}
    </button>
  );
}

export function MoveBtns({ i, n, onMove }: { i: number; n: number; onMove: (dir: -1 | 1) => void }) {
  return (
    <>
      <IconBtn label="Move up" disabled={i === 0} onClick={() => onMove(-1)}><ArrowUp className="size-3.5" /></IconBtn>
      <IconBtn label="Move down" disabled={i === n - 1} onClick={() => onMove(1)}><ArrowDown className="size-3.5" /></IconBtn>
    </>
  );
}

export function AddBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
      <Plus className="size-4" /> {children}
    </button>
  );
}

export function SectionCard({ icon: Icon, title, done, open, onToggle, children, actions }: { icon: React.ComponentType<{ className?: string }>; title: string; done: number; open: boolean; onToggle: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card transition-shadow", open && "shadow-soft")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex flex-1 items-center gap-3 text-left">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span>
          <span className="flex-1 text-sm font-medium">{title}</span>
          <span className={cn("grid size-5 place-items-center rounded-full border text-[10px]", done >= 1 ? "border-success bg-success text-primary-foreground" : done > 0 ? "border-warning text-warning" : "text-muted-foreground")} aria-label={done >= 1 ? "Complete" : done > 0 ? "In progress" : "Not started"}>
            {done >= 1 ? <Check className="size-3" /> : done > 0 ? "•" : ""}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {actions}
      </div>
      {open && <div className="space-y-4 border-t px-4 py-4 animate-rise">{children}</div>}
    </section>
  );
}

export function EntryCard({ title, sub, onRemove, onMove, i, n, children, defaultOpen }: { title: string; sub?: string; onRemove: () => void; onMove: (d: -1 | 1) => void; i: number; n: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-lg border bg-surface/50">
      <div className="flex items-center gap-1 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className="truncate text-sm font-medium">{title}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </button>
        <MoveBtns i={i} n={n} onMove={onMove} />
        <IconBtn label="Remove" danger onClick={onRemove}><Trash2 className="size-3.5" /></IconBtn>
        <IconBtn label={open ? "Collapse" : "Edit"} onClick={() => setOpen(!open)}><ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} /></IconBtn>
      </div>
      {open && <div className="space-y-3 border-t bg-card px-3 py-3">{children}</div>}
    </div>
  );
}

export function BulletEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-foreground/80">{label}</p>
      <div className="space-y-1.5">
        {items.map((b, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <textarea rows={1} value={b} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} className={cn(inputCls, "min-h-9 resize-y py-1.5")} />
            <MoveBtns i={i} n={items.length} onMove={(d) => { const o = [...items]; const j = i + d; [o[i], o[j]] = [o[j]!, o[i]!]; onChange(o); }} />
            <IconBtn label="Remove bullet" danger onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-3.5" /></IconBtn>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, ""])} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="size-3" /> Add bullet</button>
    </div>
  );
}

export function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const parts = v.split(",").map((s) => s.trim()).filter((s) => s && !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...tags, ...parts]);
    setV("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring/25">
      {tags.map((t, i) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-md bg-accent py-0.5 pr-0.5 pl-2 text-xs text-accent-foreground">
          <button type="button" title="Move left" className="hover:underline disabled:no-underline" disabled={i === 0} onClick={() => { const o = [...tags]; [o[i - 1], o[i]] = [o[i]!, o[i - 1]!]; onChange(o); }}>{t}</button>
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-background/60"><X className="size-3" /></button>
        </span>
      ))}
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } if (e.key === "Backspace" && !v && tags.length) onChange(tags.slice(0, -1)); }} placeholder={tags.length ? "Add more…" : placeholder} className="min-w-28 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground/70" />
    </div>
  );
}

/** Asks the AI for clearer wording, then lets the user accept, edit or reject. */
export function ImproveButton({ text, kind, role, onAccept }: { text: string; kind: "summary" | "bullet" | "project"; role?: string; onAccept: (v: string) => void }) {
  const server = useServerFn(improveWording);
  const run = (a: Parameters<typeof server>[0]) => (USE_API ? ai.improveWording(a!.data as object) : server(a));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  async function go() {
    if (text.trim().length < 10) { toast.message("Write a sentence or two first — suggestions only reword what you've written."); return; }
    setBusy(true);
    try {
      const r = await run({ data: { kind, text, ...(role ? { role } : {}) } });
      if (r.ok) setDraft(r.text);
      else toast.error(r.error);
    } catch {
      toast.error("Couldn't get a suggestion. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={go} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-60">
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Improve wording
      </button>
      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Suggested wording</DialogTitle>
            <DialogDescription>Uses only what you wrote — nothing new is added. Check it's still accurate, edit if needed, then apply.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><p className="eyebrow">Original</p><p className="mt-1 rounded-lg bg-surface p-3 text-sm text-muted-foreground">{text}</p></div>
            <div><p className="eyebrow">Suggestion</p><textarea rows={5} value={draft ?? ""} onChange={(e) => setDraft(e.target.value)} className={cn(inputCls, "mt-1")} /></div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Keep original</button>
            <button type="button" onClick={() => { onAccept(draft ?? text); setDraft(null); toast.success("Wording applied"); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Apply</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
