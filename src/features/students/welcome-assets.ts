"use client";

import type { Student, Profile } from "@/lib/store/local-db";

/**
 * Programmatic, on-brand welcome assets for a newly admitted student — an ID
 * card and a shareable welcome poster — drawn entirely on a canvas so every
 * centre gets them with zero setup (no template upload needed). Exported as PNG
 * for printing / WhatsApp sharing.
 */

const BRAND = "#ea580c"; // primary orange
const BRAND_DARK = "#9a3412";
const INK = "#1f2937";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fall back to an initials placeholder
    img.src = src;
  });
}

const fmtDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const safe = (s: string) => (s || "student").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/** Draw `img` cover-fitted into the rect, clipped to the current path. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const r = w / h;
  let dw = w, dh = h, dx = x, dy = y;
  if (ir > r) { dw = h * ir; dx = x - (dw - w) / 2; } else { dh = w / ir; dy = y - (dh - h) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, maxPx: number, maxWidth: number) {
  let size = maxPx;
  do {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= 14) break;
    size -= 2;
  } while (size > 14);
  return size;
}

/** Student ID card — landscape 1000×630 (standard card ratio). */
export async function renderIdCard(student: Student, profile: Profile, levelName: string): Promise<HTMLCanvasElement> {
  const W = 1000, H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const name = `${student.firstName} ${student.lastName}`.trim();

  // card body
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // header band
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, BRAND); grad.addColorStop(1, BRAND_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 120);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `bold ${fitFont(ctx, profile.businessName || "Your Institute", "bold", 46, 640)}px Arial, sans-serif`;
  ctx.fillText(profile.businessName || "Your Institute", 40, 54);
  ctx.font = "500 24px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("Student Identity Card", 40, 92);

  // photo
  const px = 40, py = 165, pw = 260, ph = 320;
  const photo = await loadImage(student.photo);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.closePath(); ctx.clip();
  if (photo) {
    drawCover(ctx, photo, px, py, pw, ph);
  } else {
    ctx.fillStyle = "#fde7d6"; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = BRAND; ctx.textAlign = "center"; ctx.font = "bold 96px Arial, sans-serif";
    ctx.fillText(initials(name) || "🙂", px + pw / 2, py + ph / 2);
  }
  ctx.restore();
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke();

  // details
  const dx = 350;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `bold ${fitFont(ctx, name, "bold", 48, W - dx - 40)}px Arial, sans-serif`;
  ctx.fillText(name, dx, 200);

  const rows: [string, string][] = [
    ["Student ID", student.code || "—"],
    ["Level", levelName || "—"],
    ["Admission", fmtDate(student.admissionDate) || "—"],
    ["Parent", student.parentName || student.fatherName || "—"],
    ["Contact", student.parentMobile || student.fatherContact || "—"],
  ];
  let ry = 260;
  for (const [k, v] of rows) {
    ctx.fillStyle = "#9ca3af"; ctx.font = "600 20px Arial, sans-serif";
    ctx.fillText(k.toUpperCase(), dx, ry);
    ctx.fillStyle = INK; ctx.font = `600 ${fitFont(ctx, v, "600", 30, W - dx - 40)}px Arial, sans-serif`;
    ctx.fillText(v, dx, ry + 30);
    ry += 74;
  }

  // footer strip
  ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = "#6b7280"; ctx.font = "500 20px Arial, sans-serif"; ctx.textAlign = "center";
  const foot = [profile.phone, profile.city, profile.website].filter(Boolean).join("   ·   ");
  ctx.fillText(foot || "Powered by EduFlow", W / 2, H - 23);
  return canvas;
}

/** Shareable welcome poster — portrait 1080×1350 (social-friendly). */
export async function renderWelcomePoster(student: Student, profile: Profile, levelName: string): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const name = `${student.firstName} ${student.lastName}`.trim();

  // gradient background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fb923c"); g.addColorStop(0.55, BRAND); g.addColorStop(1, BRAND_DARK);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft decorative circles
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(W - 80, 160, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(120, H - 120, 200, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  // centre name
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fitFont(ctx, profile.businessName || "Your Institute", "bold", 56, W - 140)}px Arial, sans-serif`;
  ctx.fillText(profile.businessName || "Your Institute", W / 2, 120);
  ctx.font = "600 34px Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("WELCOMES A NEW STUDENT", W / 2, 178);

  // photo circle
  const cx = W / 2, cy = 560, rad = 250;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  const photo = await loadImage(student.photo);
  if (photo) {
    drawCover(ctx, photo, cx - rad, cy - rad, rad * 2, rad * 2);
  } else {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.fillStyle = BRAND; ctx.font = "bold 180px Arial, sans-serif";
    ctx.fillText(initials(name) || "🙂", cx, cy);
  }
  ctx.restore();
  ctx.lineWidth = 12; ctx.strokeStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();

  // welcome text
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 40px Arial, sans-serif";
  ctx.fillText("A warm welcome to", W / 2, 900);
  ctx.font = `bold ${fitFont(ctx, name, "bold", 88, W - 120)}px Arial, sans-serif`;
  ctx.fillText(name, W / 2, 985);

  // level pill
  if (levelName) {
    ctx.font = "700 36px Arial, sans-serif";
    const tw = ctx.measureText(levelName).width;
    const pillW = tw + 80, pillH = 74, px = W / 2 - pillW / 2, py = 1055;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.roundRect(px, py, pillW, pillH, 37); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(levelName, W / 2, py + pillH / 2);
  }

  // footer: contact / socials
  ctx.font = "500 30px Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.95)";
  const handles = [
    profile.website?.replace(/^https?:\/\//, ""),
    profile.instagram && `@${profile.instagram.replace(/^@/, "")}`,
    profile.phone,
  ].filter(Boolean).join("    ·    ");
  ctx.fillText(handles || "Welcome aboard! 🎉", W / 2, H - 90);
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}

export const assetFilename = (kind: string, name: string) => `${kind}-${safe(name)}.png`;
