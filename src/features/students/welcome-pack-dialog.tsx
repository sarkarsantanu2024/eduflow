"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, PartyPopper, Cake, Video } from "lucide-react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { type Student, type Profile, type Course } from "@/lib/store/local-db";
import { PosterCard, type Occasion } from "@/features/students/poster-card";
import { renderPosterVideo, videoSupported } from "@/features/students/welcome-video";

const safe = (s: string) => (s || "student").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

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
      `Wishing ${name} a wonderful year ahead filled with joy, learning and success. The whole team at ${biz} is celebrating with you today!\n` +
      (l ? `\nStay connected with us:\n${l}\n` : "") + `\nWith love,\n— ${biz}`
    );
  }
  return (
    `Dear ${parent}, welcome to ${biz}! 🎉\n\n` +
    `We're delighted to have ${name}${level ? ` join ${level}` : " on board"}. Your welcome kit is ready at the centre.\n` +
    (l ? `\nStay connected with us:\n${l}\n` : "") + `\nWe're excited to be part of ${name}'s learning journey!\n— ${biz}`
  );
}

const META: Record<Occasion, { title: string; icon: typeof PartyPopper; noun: string }> = {
  welcome: { title: "Welcome pack", icon: PartyPopper, noun: "welcome" },
  birthday: { title: "Birthday greeting", icon: Cake, noun: "birthday" },
};

function preload(src: string) {
  return new Promise<void>((res) => {
    if (!src) return res();
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(); i.onerror = () => res(); i.src = src;
  });
}

export function PosterPackDialog({
  student, profile, courses, trigger, occasion = "welcome",
}: { student: Student; profile: Profile; courses: Course[]; trigger: React.ReactNode; occasion?: Occasion }) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<string>("");
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const [genVideo, setGenVideo] = useState(false);
  const [tab, setTab] = useState<"image" | "video">("image");
  const cardRef = useRef<HTMLDivElement>(null);
  const meta = META[occasion];
  const level = courses.find((c) => c.id === student.courseId)?.name ?? "";
  const name = `${student.firstName} ${student.lastName}`.trim();
  const mobile = student.parentMobile || student.fatherContact || student.motherContact || "";
  const Icon = meta.icon;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setImg(""); setVideo(null);
    (async () => {
      await Promise.all([preload(student.photo), preload(profile.avatar)]);
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      if (!alive || !cardRef.current) return;
      try { const url = await toPng(cardRef.current, { pixelRatio: 1, cacheBust: true }); if (alive) setImg(url); } catch { /* empty */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function saveFile(href: string, filename: string) {
    const a = document.createElement("a"); a.href = href; a.download = filename; a.click();
  }
  function download() { if (img) saveFile(img, `${meta.noun}-${safe(name)}.png`); }

  async function makeVideo() {
    if (!img) return;
    setGenVideo(true);
    try {
      const v = await renderPosterVideo(img, occasion);
      setVideo(v);
    } catch { /* leave unset */ } finally { setGenVideo(false); }
  }

  const msg = message(occasion, student, profile, level);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Icon className="size-5 text-primary" /> {meta.title} — {name}</DialogTitle>
          <DialogDescription>Ready-made poster with the student &amp; centre details filled in. Download it and send on WhatsApp.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            {/* Image / Video tabs — keeps the dialog short */}
            <div className="inline-grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
              {(["image", "video"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`rounded-md px-4 py-1.5 capitalize transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "image" ? (
              <>
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  {img ? <img src={img} alt={`${meta.noun} poster`} className="mx-auto max-h-[58vh] w-auto" /> : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Rendering…</div>}
                </div>
                <Button size="sm" variant="outline" onClick={download} disabled={!img}><Download className="size-4" /> Download poster</Button>
              </>
            ) : video ? (
              <>
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  <video src={video.url} controls autoPlay loop muted playsInline className="mx-auto max-h-[58vh] w-auto" />
                </div>
                <Button size="sm" variant="outline" onClick={() => saveFile(video.url, `${meta.noun}-${safe(name)}.${video.ext}`)}>
                  <Download className="size-4" /> Download video (.{video.ext})
                </Button>
                {video.ext === "webm" && <p className="text-xs text-amber-600">webm — test playback on your phone; some WhatsApp versions prefer mp4.</p>}
              </>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                <p>Turn the poster into a short animated clip (~6s) to share on WhatsApp.</p>
                {videoSupported()
                  ? <Button size="sm" variant="outline" onClick={makeVideo} disabled={!img || genVideo}><Video className="size-4" /> {genVideo ? "Making video… (~6s)" : "Make video"}</Button>
                  : <p className="text-destructive">Video generation isn&apos;t supported in this browser.</p>}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2 rounded-lg border p-4">
            <p className="text-sm font-semibold">WhatsApp message</p>
            <div className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">{msg}</div>
            <p className="text-xs text-muted-foreground">Tip: download the poster (or video) first, then attach it after WhatsApp opens.</p>
            {mobile
              ? <SendOnWhatsApp phone={mobile} message={msg} label="Open WhatsApp" />
              : <p className="text-xs text-destructive">No parent mobile on file — add one on the student to send this.</p>}
          </div>
        </div>

        {/* Off-screen full-resolution poster for capture */}
        <div style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }} aria-hidden>
          <PosterCard ref={cardRef} occasion={occasion} student={student} profile={profile} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
