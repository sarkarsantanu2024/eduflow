"use client";

import { jsPDF } from "jspdf";
import type { Student, Profile, IdCardDesign } from "@/lib/store/local-db";

/**
 * Downloadable student ID cards, matching the PrintReady layout the owner uses:
 * landscape 88 × 56 mm cards, an institute header band (logo + name + tagline +
 * website) and a coloured card body with the photo left and labelled fields
 * right. Cards are drawn straight into an A4 PDF — 10 per page (2 × 5) with
 * dashed outlines and corner crop marks for cutting; bulk downloads are split
 * into files of at most 20 cards (2 pages) so they stay easy to print.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface IdCardContext {
  courseName: (id: string) => string;
  batchName: (id: string) => string;
}

// The design itself (IdCardDesign) lives on the institute profile — set once,
// every device prints the same card. See src/lib/store/types.ts.
export type { IdCardDesign };

/** Card-background swatches offered in the customise panel. */
export const CARD_BG_PRESETS = [
  "#FFF164", "#FFFFFF", "#FFE9A8", "#BFD3FF", "#A8EBC9", "#FFC7E0", "#FFD9B3", "#E3D0FF",
];

/** Bulk downloads are chunked into PDFs of at most this many cards (2 A4 pages). */
export const MAX_CARDS_PER_PDF = 20;

// ── Geometry (mm) ────────────────────────────────────────────────────
const CARD_W = 88, CARD_H = 56;
const COLS = 2, ROWS = 5; // 10 cards per A4 page
const PAGE_W = 210, PAGE_H = 297;
const GAP_X = 6, GAP_Y = 1.5;
const MARGIN_X = (PAGE_W - COLS * CARD_W - (COLS - 1) * GAP_X) / 2;
const MARGIN_Y = (PAGE_H - ROWS * CARD_H - (ROWS - 1) * GAP_Y) / 2;
const BAND_H = 12;

/** Academic session shown on the card, e.g. "2026–27". */
function session(): string {
  const y = new Date().getFullYear();
  return `${y}–${String((y + 1) % 100).padStart(2, "0")}`;
}

function fieldsFor(s: Student, profile: Profile, ctx: IdCardContext, design: IdCardDesign): [string, string][] {
  const level = ctx.courseName(s.courseId);
  return [
    ["Name", `${s.firstName} ${s.lastName}`.trim()],
    ["ID", [s.code, level].filter(Boolean).join(" · ")],
    ["Center", design.companyName || profile.businessName || s.centreName],
    ["Phone", s.parentMobile || s.fatherContact || s.motherContact],
    ["Address", [s.address, s.city].filter(Boolean).join(", ")],
    ["Guardian", s.parentName || s.fatherName || s.motherName],
  ];
}

// ── Image helpers ────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Photo cropped to cover the given aspect ratio → JPEG data URL. */
async function coverJpeg(src: string, ratio: number): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    let sw = w, sh = w / ratio;
    if (sh > h) { sh = h; sw = h * ratio; }
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = Math.round(300 / ratio);
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

/** Logo fit inside a square, transparency preserved → PNG data URL. */
async function containPng(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    const size = 240;
    const scale = Math.min(size / w, size / h);
    const dw = w * scale, dh = h * scale;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ── PDF drawing ──────────────────────────────────────────────────────

function hex(doc: jsPDF, method: "setFillColor" | "setDrawColor" | "setTextColor", color: string) {
  const m = color.match(/^#?([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1]!, 16) : 0;
  doc[method]((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** Truncate text with an ellipsis so it fits maxW mm at the current font. */
function fit(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Small corner crop marks (cutting guides) just outside the card. */
function cropMarks(doc: jsPDF, x: number, y: number) {
  const L = 2.5, o = 0.8; // mark length, offset from the corner
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([], 0);
  const corners: [number, number, number, number][] = [
    [x, y, -1, -1], [x + CARD_W, y, 1, -1], [x, y + CARD_H, -1, 1], [x + CARD_W, y + CARD_H, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    doc.line(cx + dx * o, cy, cx + dx * (o + L), cy);
    doc.line(cx, cy + dy * o, cx, cy + dy * (o + L));
  }
}

interface Assets { logo: string | null; photos: Map<string, string | null> }

function drawCard(
  doc: jsPDF, x: number, y: number,
  s: Student, profile: Profile, ctx: IdCardContext, design: IdCardDesign, assets: Assets,
) {
  // Card + header band
  hex(doc, "setFillColor", design.cardBg);
  doc.rect(x, y, CARD_W, CARD_H, "F");
  hex(doc, "setFillColor", design.headerBg);
  doc.rect(x, y, CARD_W, BAND_H, "F");

  // Logo — drawn as-is (transparent PNGs sit directly on the band colour)
  const textX = assets.logo ? x + 14 : x + 3;
  if (assets.logo) doc.addImage(assets.logo, "PNG", x + 3, y + 1.75, 8.5, 8.5);

  // Header text
  hex(doc, "setTextColor", design.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const brand = (design.companyName || profile.businessName || "Institute").toUpperCase();
  doc.text(fit(doc, brand, CARD_W - (textX - x) - 3), textX, y + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  let hy = y + 7.4;
  if (design.tagline) { doc.text(fit(doc, design.tagline, CARD_W - (textX - x) - 3), textX, hy); hy += 2.7; }
  const website = design.website || profile.website;
  if (website) { doc.setFont("helvetica", "italic"); doc.text(fit(doc, website, CARD_W - (textX - x) - 3), textX, hy); }

  // Photo (20 × 25 mm, black frame). No photo → grey box with initials.
  const px = x + 3, py = y + BAND_H + 2.2, pw = 20, ph = 25;
  const photo = assets.photos.get(s.id);
  if (photo) {
    doc.addImage(photo, "JPEG", px, py, pw, ph);
  } else {
    doc.setFillColor(238, 239, 241);
    doc.rect(px, py, pw, ph, "F");
    doc.setTextColor(150, 155, 165);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
    doc.text(initials, px + pw / 2, py + ph / 2 + 2, { align: "center" });
  }
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([], 0);
  doc.rect(px, py, pw, ph, "S");

  // Fields
  const fx = x + 26.5, fw = CARD_W - 26.5 - 3;
  let fy = y + BAND_H + 4;
  for (const [label, value] of fieldsFor(s, profile, ctx, design)) {
    doc.setTextColor(90, 95, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.text(label.toUpperCase(), fx, fy, { charSpace: 0.25 });
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(7);
    doc.text(fit(doc, value || "—", fw), fx, fy + 2.6);
    fy += 6.6;
  }

  // Session + cutting guides
  doc.setTextColor(110, 115, 125);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.text(`Session ${session()}`, x + CARD_W - 3, y + CARD_H - 1.6, { align: "right" });

  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(x, y, CARD_W, CARD_H, "S");
  cropMarks(doc, x, y);
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

/**
 * Download the given students' ID cards as PDF(s): 10 cards per A4 page, at
 * most MAX_CARDS_PER_PDF per file (bigger batches download as several files).
 * Returns the number of cards rendered.
 */
export async function downloadIdCardsPdf(
  students: Student[], profile: Profile, ctx: IdCardContext, design: IdCardDesign,
): Promise<number> {
  if (students.length === 0) return 0;

  const assets: Assets = {
    logo: (design.logo || profile.avatar) ? await containPng(design.logo || profile.avatar) : null,
    photos: new Map(),
  };
  await Promise.all(students.map(async (s) => {
    assets.photos.set(s.id, s.photo ? await coverJpeg(s.photo, 20 / 25) : null);
  }));

  for (let start = 0; start < students.length; start += MAX_CARDS_PER_PDF) {
    const chunk = students.slice(start, start + MAX_CARDS_PER_PDF);
    const doc = new jsPDF("p", "mm", "a4");
    chunk.forEach((s, i) => {
      const slot = i % (COLS * ROWS);
      if (i > 0 && slot === 0) doc.addPage("a4", "p");
      const x = MARGIN_X + (slot % COLS) * (CARD_W + GAP_X);
      const y = MARGIN_Y + Math.floor(slot / COLS) * (CARD_H + GAP_Y);
      drawCard(doc, x, y, s, profile, ctx, design, assets);
    });
    const only = chunk.length === 1 ? chunk[0] : null;
    const name = only
      ? `id-card-${safe(`${only.firstName} ${only.lastName}`.trim() || only.code)}.pdf`
      : `id-cards-${start + 1}-${start + chunk.length}.pdf`;
    doc.save(name);
  }
  return students.length;
}

// ── Live preview (HTML mirror of the PDF layout, shown in an iframe) ─

export function previewIdCardHtml(s: Student, profile: Profile, ctx: IdCardContext, design: IdCardDesign): string {
  const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
  const brand = (design.companyName || profile.businessName || "Institute").toUpperCase();
  const website = design.website || profile.website;
  const logo = design.logo || profile.avatar;
  const rows = fieldsFor(s, profile, ctx, design);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { background: #f4f4f2; display: flex; justify-content: center; padding: 12px; }
    .card {
      width: 88mm; height: 56mm; border: 0.35mm dashed #9ca3af;
      overflow: hidden; display: flex; flex-direction: column; position: relative;
      background: ${design.cardBg};
    }
    .band { display: flex; align-items: center; gap: 2.5mm; background: ${design.headerBg}; color: ${design.headerText}; padding: 1.8mm 3mm; min-height: 12mm; }
    .logo { width: 8.5mm; height: 8.5mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo img { width: 100%; height: 100%; object-fit: contain; }
    .biz { font-size: 3.4mm; font-weight: 800; letter-spacing: 0.2mm; text-transform: uppercase; line-height: 1.15; }
    .tag { font-size: 2.1mm; opacity: 0.92; }
    .web { font-size: 2.1mm; font-style: italic; opacity: 0.92; }
    .body { flex: 1; display: flex; gap: 3mm; padding: 2.2mm 3mm 1mm; min-height: 0; }
    .photo {
      width: 20mm; height: 25mm; border: 0.6mm solid #111827; background: #eeeff1; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      font-size: 7mm; font-weight: 700; color: #9ca3af;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .fields { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
    .k { font-size: 1.8mm; font-weight: 700; letter-spacing: 0.35mm; text-transform: uppercase; color: rgba(17,24,39,0.55); }
    .v { font-size: 2.5mm; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .foot { position: absolute; right: 3mm; bottom: 1.2mm; font-size: 1.8mm; color: rgba(17,24,39,0.5); }
  </style></head><body>
  <div class="card">
    <div class="band">
      ${logo ? `<span class="logo"><img src="${esc(logo)}" alt="" /></span>` : ""}
      <div>
        <div class="biz">${esc(brand)}</div>
        ${design.tagline ? `<div class="tag">${esc(design.tagline)}</div>` : ""}
        ${website ? `<div class="web">${esc(website)}</div>` : ""}
      </div>
    </div>
    <div class="body">
      <div class="photo">${s.photo ? `<img src="${esc(s.photo)}" alt="" />` : `<span>${esc(initials)}</span>`}</div>
      <div class="fields">
        ${rows.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${esc(v) || "—"}</div></div>`).join("")}
      </div>
    </div>
    <div class="foot">Session ${session()}</div>
  </div>
  </body></html>`;
}
