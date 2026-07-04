"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { Download, IdCard, Image as ImageIcon, PartyPopper, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { updateItem, type Student, type Profile, type Course, type WelcomeKit } from "@/lib/store/local-db";
import { renderIdCard, renderWelcomePoster, downloadCanvas, assetFilename } from "@/features/students/welcome-assets";

const KIT_ITEMS: { key: keyof WelcomeKit; label: string }[] = [
  { key: "bag", label: "Bag" },
  { key: "tshirt", label: "T-shirt" },
  { key: "idCard", label: "ID card" },
  { key: "feesCard", label: "Fees card" },
  { key: "books", label: "Books (by level)" },
  { key: "welcomeFile", label: "Welcome file" },
];

function welcomeMessage(student: Student, profile: Profile, level: string) {
  const name = `${student.firstName} ${student.lastName}`.trim();
  const parent = student.parentName || student.fatherName || student.motherName || "Parent";
  const links = [
    profile.website && `🌐 ${profile.website}`,
    profile.facebook && `📘 Facebook: ${profile.facebook}`,
    profile.instagram && `📸 Instagram: ${profile.instagram}`,
    profile.youtube && `▶️ YouTube: ${profile.youtube}`,
  ].filter(Boolean).join("\n");
  return (
    `Dear ${parent}, welcome to ${profile.businessName || "our institute"}! 🎉\n\n` +
    `We're delighted to have ${name}${level ? ` join ${level}` : " on board"}. ` +
    `Your welcome kit and ID card are ready at the centre.\n` +
    (links ? `\nStay connected with us:\n${links}\n` : "") +
    `\nWe're excited to be part of ${name}'s learning journey!\n— ${profile.businessName || "Team"}`
  );
}

export function WelcomePackDialog({
  student, profile, courses, trigger,
}: { student: Student; profile: Profile; courses: Course[]; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [idCard, setIdCard] = useState<string>("");
  const [poster, setPoster] = useState<string>("");
  const level = courses.find((c) => c.id === student.courseId)?.name ?? "";
  const name = `${student.firstName} ${student.lastName}`.trim();
  const mobile = student.parentMobile || student.fatherContact || student.motherContact || "";
  const kit: WelcomeKit = (student.welcomeKit && typeof student.welcomeKit === "object" ? student.welcomeKit : {}) as WelcomeKit;

  // Render both assets as PNGs once the dialog opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void renderIdCard(student, profile, level).then((c) => { if (alive) setIdCard(c.toDataURL("image/png")); });
    void renderWelcomePoster(student, profile, level).then((c) => { if (alive) setPoster(c.toDataURL("image/png")); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key: keyof WelcomeKit) =>
    updateItem<Student>("students", student.id, { welcomeKit: { ...kit, [key]: !kit[key] } });

  async function download(kind: "id-card" | "poster") {
    const canvas = kind === "id-card"
      ? await renderIdCard(student, profile, level)
      : await renderWelcomePoster(student, profile, level);
    downloadCanvas(canvas, assetFilename(kind, name));
  }

  const doneCount = KIT_ITEMS.filter((i) => kit[i.key]).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PartyPopper className="size-5 text-primary" /> Welcome pack — {name}</DialogTitle>
          <DialogDescription>Generate the ID card & poster, send the WhatsApp welcome, and track the kit handover.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assets */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><IdCard className="size-4" /> ID card</p>
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                {idCard ? <img src={idCard} alt="ID card preview" className="w-full" /> : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Rendering…</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => download("id-card")}><Download className="size-4" /> Download ID card</Button>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><ImageIcon className="size-4" /> Welcome poster</p>
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                {poster ? <img src={poster} alt="Poster preview" className="mx-auto max-h-64 w-auto" /> : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Rendering…</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => download("poster")}><Download className="size-4" /> Download poster</Button>
            </div>
          </div>

          {/* WhatsApp welcome */}
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-semibold">WhatsApp welcome message</p>
            <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
              {welcomeMessage(student, profile, level)}
            </div>
            <p className="text-xs text-muted-foreground">
              After WhatsApp opens, attach the <strong>poster</strong>, <strong>ID card</strong>, your <strong>welcome video</strong> and the <strong>payment receipt</strong> — download them above first.
            </p>
            {mobile
              ? <SendOnWhatsApp phone={mobile} message={welcomeMessage(student, profile, level)} label="Open WhatsApp" />
              : <p className="text-xs text-destructive">No parent mobile on file — add one on the student to send the welcome.</p>}
          </div>

          {/* Handover checklist */}
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-semibold">Welcome kit handover <span className="font-normal text-muted-foreground">· {doneCount}/{KIT_ITEMS.length} done</span></p>
            <div className="grid gap-2 sm:grid-cols-2">
              {KIT_ITEMS.map((i) => (
                <label key={i.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40">
                  <input type="checkbox" checked={!!kit[i.key]} onChange={() => toggle(i.key)} className="size-4" />
                  {kit[i.key] && <CheckCircle2 className="size-4 text-emerald-600" />}
                  <span className={kit[i.key] ? "font-medium" : ""}>{i.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
