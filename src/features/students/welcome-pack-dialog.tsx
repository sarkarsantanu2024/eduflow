"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Image as ImageIcon, PartyPopper, Cake } from "lucide-react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { type Student, type Profile, type Course } from "@/lib/store/local-db";
import { renderPosterCanvas, downloadCanvas, assetFilename } from "@/features/students/welcome-assets";

type Occasion = "welcome" | "birthday";

const links = (p: Profile) => [
  p.website && `🌐 ${p.website}`,
  p.facebook && `📘 Facebook: ${p.facebook}`,
  p.instagram && `📸 Instagram: ${p.instagram}`,
  p.youtube && `▶️ YouTube: ${p.youtube}`,
  p.extraLink && `🔗 ${p.extraLink}`,
].filter(Boolean).join("\n");

function message(occasion: Occasion, student: Student, profile: Profile, level: string) {
  const name = `${student.firstName} ${student.lastName}`.trim();
  const parent = student.parentName || student.fatherName || student.motherName || "Parent";
  const l = links(profile);
  const biz = profile.businessName || "our institute";
  if (occasion === "birthday") {
    return (
      `Dear ${parent}, a very Happy Birthday to ${name}! 🎂🎉\n\n` +
      `Wishing ${name} a wonderful year ahead filled with joy, learning and success. ` +
      `The whole team at ${biz} is celebrating with you today!\n` +
      (l ? `\nStay connected with us:\n${l}\n` : "") +
      `\nWith love,\n— ${biz}`
    );
  }
  return (
    `Dear ${parent}, welcome to ${biz}! 🎉\n\n` +
    `We're delighted to have ${name}${level ? ` join ${level}` : " on board"}. ` +
    `Your welcome kit is ready at the centre.\n` +
    (l ? `\nStay connected with us:\n${l}\n` : "") +
    `\nWe're excited to be part of ${name}'s learning journey!\n— ${biz}`
  );
}

const META: Record<Occasion, { title: string; posterLabel: string; icon: typeof PartyPopper; noun: string }> = {
  welcome: { title: "Welcome pack", posterLabel: "Welcome poster", icon: PartyPopper, noun: "welcome" },
  birthday: { title: "Birthday greeting", posterLabel: "Birthday poster", icon: Cake, noun: "birthday" },
};

export function PosterPackDialog({
  student, profile, courses, trigger, occasion = "welcome",
}: { student: Student; profile: Profile; courses: Course[]; trigger: React.ReactNode; occasion?: Occasion }) {
  const [open, setOpen] = useState(false);
  const [poster, setPoster] = useState<string>("");
  const meta = META[occasion];
  const level = courses.find((c) => c.id === student.courseId)?.name ?? "";
  const name = `${student.firstName} ${student.lastName}`.trim();
  const mobile = student.parentMobile || student.fatherContact || student.motherContact || "";
  const design = profile.posters?.[occasion];
  const Icon = meta.icon;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPoster("");
    void renderPosterCanvas(design, student).then((c) => { if (alive && c) setPoster(c.toDataURL("image/png")); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function download() {
    const c = await renderPosterCanvas(design, student);
    if (c) downloadCanvas(c, assetFilename(meta.noun, name));
  }

  const msg = message(occasion, student, profile, level);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Icon className="size-5 text-primary" /> {meta.title} — {name}</DialogTitle>
          <DialogDescription>Generate the {meta.noun} poster and send it on WhatsApp.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><ImageIcon className="size-4" /> {meta.posterLabel}</p>
            {design?.image ? (
              <>
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  {poster ? <img src={poster} alt={meta.posterLabel} className="mx-auto max-h-80 w-auto" /> : <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Rendering…</div>}
                </div>
                <Button size="sm" variant="outline" onClick={download}><Download className="size-4" /> Download poster</Button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No {meta.noun} template yet. Upload one under{" "}
                <Link href="/profile" className="font-medium text-primary underline">Profile › Poster templates</Link>
                {" "}— the student&apos;s photo &amp; name are added automatically.
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-semibold">WhatsApp message</p>
            <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">{msg}</div>
            <p className="text-xs text-muted-foreground">After WhatsApp opens, attach the <strong>poster</strong> you downloaded above.</p>
            {mobile
              ? <SendOnWhatsApp phone={mobile} message={msg} label="Open WhatsApp" />
              : <p className="text-xs text-destructive">No parent mobile on file — add one on the student to send this.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
