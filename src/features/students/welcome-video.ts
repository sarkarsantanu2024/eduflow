"use client";

import type { Occasion } from "@/features/students/poster-card";

/**
 * Turns the already-rendered poster PNG into a short animated clip, entirely in
 * the browser: the poster fades/zooms in, a shine sweeps across, and themed
 * confetti falls — captured from a canvas via MediaRecorder. Prefers mp4 (plays
 * everywhere on WhatsApp) and falls back to webm where mp4 recording isn't
 * supported. No third-party service, no cost.
 */

const W = 1080, H = 1350, FPS = 30, DURATION = 6000; // ms

function pickMime(): string {
  const prefs = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const m of prefs) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  return "video/webm";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

type Particle = { x: number; y: number; vy: number; drift: number; size: number; rot: number; vr: number; color: string; round: boolean };

export function videoSupported() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

/** Render an animated video from the poster image. Resolves to a blob URL + file extension. */
export async function renderPosterVideo(posterUrl: string, occasion: Occasion): Promise<{ url: string; ext: string }> {
  const poster = await loadImage(posterUrl);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const mime = pickMime();
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const stream = canvas.captureStream(FPS);
  const chunks: BlobPart[] = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const palette = occasion === "birthday"
    ? ["#f59e0b", "#e11d80", "#7c3aed", "#22c55e", "#3b82f6"]
    : ["#fbbf24", "#ffffff", "#a5b4fc", "#f472b6", "#3b82f6"];
  const parts: Particle[] = Array.from({ length: 70 }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H - H,
    vy: 70 + Math.random() * 140, drift: (Math.random() - 0.5) * 50,
    size: 8 + Math.random() * 16, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 4,
    color: palette[i % palette.length] ?? "#ffffff", round: i % 2 === 0,
  }));

  return new Promise((resolve) => {
    rec.onstop = () => resolve({ url: URL.createObjectURL(new Blob(chunks, { type: mime })), ext });
    const start = performance.now();
    let last = start;
    rec.start();

    const frame = (now: number) => {
      const t = now - start;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const p = Math.min(1, t / DURATION);

      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

      // fade + zoom in, then a gentle continuous Ken-Burns zoom
      const intro = Math.min(1, t / 800);
      const scale = (0.94 + 0.06 * intro) * (1 + 0.05 * p);
      ctx.save();
      ctx.globalAlpha = intro;
      ctx.translate(W / 2, H / 2); ctx.scale(scale, scale); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(poster, 0, 0, W, H);
      ctx.restore();

      // shine sweep across the first ~1.6s
      if (t < 1600) {
        const sx = -W + (t / 1600) * (2.2 * W);
        const g = ctx.createLinearGradient(sx, 0, sx + 320, H);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.28)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // confetti
      for (const pt of parts) {
        pt.y += pt.vy * dt; pt.x += pt.drift * dt; pt.rot += pt.vr * dt;
        if (pt.y > H + 20) { pt.y = -20; pt.x = Math.random() * W; }
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot); ctx.fillStyle = pt.color; ctx.globalAlpha = 0.9;
        if (pt.round) { ctx.beginPath(); ctx.arc(0, 0, pt.size / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.6);
        ctx.restore();
      }

      if (t >= DURATION) { rec.stop(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
