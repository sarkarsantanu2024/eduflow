"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProfile, setProfile, DEFAULT_CERT_LAYOUT, type CertLayout, type Certificate } from "@/lib/store/local-db";
import { renderCertCanvas } from "@/features/certificates/cert-pdf";

const PREVIEW_CERT: Certificate = {
  id: "preview", serial: "EF-2026-0001", studentId: "",
  studentName: "Student Name", title: "Course / Level — Completion", course: "Course",
  issueDate: new Date().toISOString().slice(0, 10),
};

type FieldKey = "name" | "course" | "date" | "serial";
const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Student name", course: "Course / title", date: "Date", serial: "Serial no.",
};

export function CertDesigner() {
  const profile = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");

  const layout = profile.certLayout ?? DEFAULT_CERT_LAYOUT;

  // Re-render the live preview whenever the image or layout changes.
  useEffect(() => {
    let alive = true;
    if (!profile.certImage) { setPreview(""); return; }
    renderCertCanvas(PREVIEW_CERT, profile).then((c) => {
      if (alive && c) setPreview(c.toDataURL("image/jpeg", 0.85));
    });
    return () => { alive = false; };
  }, [profile]);

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setProfile({ certImage: String(reader.result) }); toast.success("Certificate template uploaded"); };
    reader.readAsDataURL(file);
  }

  function patch(next: Partial<CertLayout>) {
    setProfile({ certLayout: { ...layout, ...next } });
  }
  function patchField(key: FieldKey, prop: "x" | "y" | "size", value: number) {
    patch({ [key]: { ...layout[key], [prop]: value } } as Partial<CertLayout>);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-5 text-primary" /> Your certificate design
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload your own blank certificate (your brand, logo, border). EduFlow auto-fills each
          student&apos;s name, course, date and a verify QR on top — then you download the PDF.
        </p>

        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> {profile.certImage ? "Replace template" : "Upload blank certificate"}
          </Button>
          {profile.certImage && (
            <Button variant="outline" onClick={() => { setProfile({ certImage: "" }); toast.success("Template removed"); }}>
              <Trash2 className="text-destructive" /> Remove
            </Button>
          )}
          {profile.certImage && (
            <Button variant="outline" onClick={() => { setProfile({ certLayout: DEFAULT_CERT_LAYOUT }); toast.success("Layout reset"); }}>
              Reset positions
            </Button>
          )}
        </div>

        {!profile.certImage ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            No template yet — using the built-in printable certificate. Upload your blank design to brand it.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Live preview */}
            <div className="space-y-2">
              <Label>Live preview</Label>
              {preview
                ? <img src={preview} alt="certificate preview" className="w-full rounded-lg border bg-white" />
                : <div className="grid h-48 place-items-center rounded-lg border text-sm text-muted-foreground">Rendering…</div>}
            </div>

            {/* Position controls */}
            <div className="space-y-4">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">{FIELD_LABELS[key]}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Slider label="X" value={layout[key].x} min={0} max={100} onChange={(v) => patchField(key, "x", v)} />
                    <Slider label="Y" value={layout[key].y} min={0} max={100} onChange={(v) => patchField(key, "y", v)} />
                    <Slider label="Size" value={layout[key].size} min={8} max={80} onChange={(v) => patchField(key, "size", v)} />
                  </div>
                </div>
              ))}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Verify QR</Label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={layout.qr.show} onChange={(e) => patch({ qr: { ...layout.qr, show: e.target.checked } })} />
                    Show
                  </label>
                </div>
                {layout.qr.show && (
                  <div className="grid grid-cols-3 gap-2">
                    <Slider label="X" value={layout.qr.x} min={0} max={100} onChange={(v) => patch({ qr: { ...layout.qr, x: v } })} />
                    <Slider label="Y" value={layout.qr.y} min={0} max={100} onChange={(v) => patch({ qr: { ...layout.qr, y: v } })} />
                    <Slider label="Size" value={layout.qr.size} min={40} max={200} onChange={(v) => patch({ qr: { ...layout.qr, size: v } })} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Text colour</Label>
                <input type="color" value={layout.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-12 rounded border" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span>{Math.round(value)}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </div>
  );
}
