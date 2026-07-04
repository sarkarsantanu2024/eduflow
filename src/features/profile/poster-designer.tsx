"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { uploadImageFile } from "@/features/uploads/upload-client";
import { DEFAULT_POSTER_DESIGN, type PosterDesign } from "@/lib/store/local-db";

type DragTarget = "photo" | "name" | null;

/**
 * Upload a poster template, then drag the student photo (circle) and name to
 * sit over the placeholder you designed. Positions/sizes are stored as % so the
 * live preview here matches the exported PNG exactly.
 */
export function PosterDesigner({
  value, onChange, sampleName = "Student Name",
}: { value?: PosterDesign; onChange: (d: PosterDesign | undefined) => void; sampleName?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragTarget>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const tId = toast.loading("Uploading template…");
    try {
      const url = await uploadImageFile(file);
      onChange(value ? { ...value, image: url } : DEFAULT_POSTER_DESIGN(url));
      toast.success("Template uploaded", { id: tId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: tId });
    } finally { setBusy(false); }
  }

  function patch(p: Partial<PosterDesign>) { if (value) onChange({ ...value, ...p }); }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !boxRef.current || !value) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    if (drag.current === "photo") patch({ photo: { ...value.photo, x, y } });
    else patch({ name: { ...value.name, x, y } });
  }

  if (!value?.image) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="mb-2 text-sm text-muted-foreground">Upload a poster template with a spot for the student&apos;s photo &amp; name.</p>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Upload template
        </Button>
      </div>
    );
  }

  const photoDiaPct = value.photo.size; // % of width

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        className="relative mx-auto max-w-xs select-none overflow-hidden rounded-lg border"
      >
        <img src={value.image} alt="template" className="block w-full" draggable={false} />
        {/* photo circle */}
        <div
          onPointerDown={(e) => { drag.current = "photo"; e.currentTarget.setPointerCapture(e.pointerId); }}
          className="absolute flex cursor-move items-center justify-center rounded-full border-2 border-white/80 bg-white/30 text-xs font-bold text-white shadow"
          style={{
            left: `${value.photo.x}%`, top: `${value.photo.y}%`,
            width: `${photoDiaPct}%`, aspectRatio: "1", transform: "translate(-50%,-50%)",
          }}
        >
          PHOTO
        </div>
        {/* name */}
        <div
          onPointerDown={(e) => { drag.current = "name"; e.currentTarget.setPointerCapture(e.pointerId); }}
          className="absolute cursor-move whitespace-nowrap font-bold drop-shadow"
          style={{
            left: `${value.name.x}%`, top: `${value.name.y}%`, transform: "translate(-50%,-50%)",
            color: value.name.color, fontSize: `${value.name.size * 0.11}px`,
          }}
        >
          {sampleName}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Drag the PHOTO circle and the name onto your template.</p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="space-y-1">
          <Label className="text-xs">Photo size</Label>
          <input type="range" min={12} max={70} value={value.photo.size}
            onChange={(e) => patch({ photo: { ...value.photo, size: Number(e.target.value) } })} className="w-full" />
        </label>
        <label className="space-y-1">
          <Label className="text-xs">Name size</Label>
          <input type="range" min={24} max={120} value={value.name.size}
            onChange={(e) => patch({ name: { ...value.name, size: Number(e.target.value) } })} className="w-full" />
        </label>
        <label className="flex items-center gap-2">
          <Label className="text-xs">Name colour</Label>
          <input type="color" value={value.name.color}
            onChange={(e) => patch({ name: { ...value.name, color: e.target.value } })} className="h-8 w-10 rounded border" />
        </label>
        <div className="flex items-end justify-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Replace
          </Button>
          <ConfirmDialog
            title="Remove this template?" confirmLabel="Remove" destructive
            onConfirm={() => onChange(undefined)}
            trigger={<Button type="button" variant="ghost" size="icon" aria-label="Remove template"><Trash2 className="text-destructive" /></Button>}
          />
        </div>
      </div>
    </div>
  );
}
