"use client";

import type { Student, PosterDesign } from "@/lib/store/local-db";

/**
 * Composites a student's photo (circular) and name onto the centre's uploaded
 * poster template — used for both the welcome poster and the birthday poster.
 * Everything is drawn on a canvas and exported as a PNG for sharing.
 */

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const safe = (s: string) => (s || "student").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height, r = w / h;
  let dw = w, dh = h, dx = x, dy = y;
  if (ir > r) { dw = h * ir; dx = x - (dw - w) / 2; } else { dh = w / ir; dy = y - (dh - h) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, px: number, maxWidth: number) {
  let size = px;
  do {
    ctx.font = `bold ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= 14) break;
    size -= 2;
  } while (size > 14);
  return size;
}

/** Draw the template + student photo + name. Returns null if no template set. */
export async function renderPosterCanvas(design: PosterDesign | undefined, student: Student): Promise<HTMLCanvasElement | null> {
  if (!design?.image) return null;
  const bg = await loadImage(design.image);
  if (!bg) return null;

  const canvas = document.createElement("canvas");
  const W = bg.naturalWidth || 1080, H = bg.naturalHeight || 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bg, 0, 0, W, H);

  const name = `${student.firstName} ${student.lastName}`.trim();

  // circular photo
  const d = (design.photo.size / 100) * W;
  const cx = (design.photo.x / 100) * W, cy = (design.photo.y / 100) * H, r = d / 2;
  const photo = await loadImage(student.photo);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (photo) {
    drawCover(ctx, photo, cx - r, cy - r, d, d);
  } else {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - r, cy - r, d, d);
    ctx.fillStyle = "#ea580c"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(r)}px Arial, sans-serif`;
    ctx.fillText(initials(name) || "🙂", cx, cy);
  }
  ctx.restore();

  // name
  const scale = W / 1000;
  ctx.fillStyle = design.name.color || "#ffffff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const px = fitFont(ctx, name, Math.round(design.name.size * scale), W * 0.9);
  ctx.font = `bold ${px}px Arial, sans-serif`;
  ctx.fillText(name, (design.name.x / 100) * W, (design.name.y / 100) * H);

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}

export const assetFilename = (kind: string, name: string) => `${kind}-${safe(name)}.png`;
