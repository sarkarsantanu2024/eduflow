"use client";

import { jsPDF } from "jspdf";
import type { Student, Profile, IdCardDesign } from "@/lib/store/local-db";

/**
 * Downloadable student ID cards, matched 1:1 to the owner's PrintReady layout
 * (which renders the card at 352 × 224 px for 88 × 56 mm — i.e. 4 px = 1 mm):
 *   header band 10mm (#E87D2E, 3mm padding, logo 7.5mm tall / width auto,
 *   name 2.7mm bold, tagline+website 1.8mm), photo 22 × 28 mm with a 0.75mm
 *   black frame, and five labelled fields (NAME / CENTER / PHONE / ADDRESS /
 *   GUARDIAN — labels 1.8mm bold grey uppercase, values 2.7mm bold, address
 *   wraps to two lines). Cards are drawn straight into an A4 PDF — 10 per page
 *   (2 × 5) with dashed outlines and corner crop marks for cutting; bulk
 *   downloads are split into files of at most 20 cards (2 pages).
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

// ── Geometry (mm) — reference renders at 4px/mm ──────────────────────
const CARD_W = 88, CARD_H = 56;
const COLS = 2, ROWS = 5; // 10 cards per A4 page
const PAGE_W = 210, PAGE_H = 297;
const GAP_X = 6, GAP_Y = 1.5;
const MARGIN_X = (PAGE_W - COLS * CARD_W - (COLS - 1) * GAP_X) / 2;
const MARGIN_Y = (PAGE_H - ROWS * CARD_H - (ROWS - 1) * GAP_Y) / 2;
const BAND_H = 10;          // 40px
const PAD = 3;              // 12px body padding / gap
const LOGO_H = 7.5;         // 30px, width auto
const PHOTO_W = 22, PHOTO_H = 28; // 88 × 112px
const LABEL_SIZE = 1.8, VALUE_SIZE = 2.7; // 7.2px / 10.8px
const MM_TO_PT = 72 / 25.4;

const LABEL_COLOR: [number, number, number] = [108, 118, 128]; // #6C7680
const VALUE_COLOR: [number, number, number] = [26, 31, 38];    // #1A1F26

function fieldsFor(s: Student, profile: Profile, design: IdCardDesign): [string, string][] {
  return [
    ["Name", `${s.firstName} ${s.lastName}`.replace(/\s+/g, " ").trim()],
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
    canvas.width = 330; canvas.height = Math.round(330 / ratio);
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

/** Logo re-encoded as PNG (transparency preserved) plus its aspect ratio,
 *  so it can be drawn "height 7.5mm, width auto" like the reference. */
async function logoPng(src: string): Promise<{ url: string; ratio: number } | null> {
  try {
    const img = await loadImage(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 480 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { url: canvas.toDataURL("image/png"), ratio: w / h };
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
  const L = 2.5, o = 0.8;
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

interface Assets { logo: { url: string; ratio: number } | null; photos: Map<string, string | null> }

function drawCard(
  doc: jsPDF, x: number, y: number,
  s: Student, profile: Profile, design: IdCardDesign, assets: Assets, cutMarks: boolean,
) {
  // Card + header band
  hex(doc, "setFillColor", design.cardBg);
  doc.rect(x, y, CARD_W, CARD_H, "F");
  hex(doc, "setFillColor", design.headerBg);
  doc.rect(x, y, CARD_W, BAND_H, "F");

  // Logo: 7.5mm tall, width auto (capped), transparent PNG straight on the band
  let textX = x + PAD;
  if (assets.logo) {
    const lw = Math.min(LOGO_H * assets.logo.ratio, 20);
    doc.addImage(assets.logo.url, "PNG", x + PAD, y + (BAND_H - LOGO_H) / 2, lw, LOGO_H);
    textX = x + PAD + lw + PAD;
  }

  // Header text — name 2.7mm bold, tagline + website 1.8mm (website italic)
  const headW = CARD_W - (textX - x) - PAD;
  hex(doc, "setTextColor", design.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(VALUE_SIZE * MM_TO_PT);
  const brand = (design.companyName || profile.businessName || "Institute").toUpperCase();
  doc.text(fit(doc, brand, headW), textX, y + 3.7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LABEL_SIZE * MM_TO_PT);
  let hy = y + 6.0;
  if (design.tagline) { doc.text(fit(doc, design.tagline, headW), textX, hy); hy += 2.2; }
  const website = design.website || profile.website;
  if (website) { doc.setFont("helvetica", "italic"); doc.text(fit(doc, website, headW), textX, hy); }

  // Photo — 22 × 28 mm, 0.75mm black frame. No photo → grey box with initials.
  const px = x + PAD, py = y + BAND_H + PAD;
  const photo = assets.photos.get(s.id);
  if (photo) {
    doc.addImage(photo, "JPEG", px, py, PHOTO_W, PHOTO_H);
  } else {
    doc.setFillColor(238, 240, 243);
    doc.rect(px, py, PHOTO_W, PHOTO_H, "F");
    doc.setTextColor(150, 155, 165);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
    doc.text(initials, px + PHOTO_W / 2, py + PHOTO_H / 2 + 2, { align: "center" });
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  doc.setLineDashPattern([], 0);
  doc.rect(px, py, PHOTO_W, PHOTO_H, "S");

  // Fields — label 1.8mm bold grey uppercase, value 2.7mm bold; 1.2mm between
  // blocks; the address value may wrap to two lines (reference wraps too).
  const fx = x + PAD + PHOTO_W + PAD, fw = CARD_W - (fx - x) - PAD;
  let fy = y + BAND_H + PAD + 1.6;
  for (const [label, value] of fieldsFor(s, profile, design)) {
    doc.setTextColor(...LABEL_COLOR);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(LABEL_SIZE * MM_TO_PT);
    doc.text(label.toUpperCase(), fx, fy, { charSpace: 0.1 });
    doc.setTextColor(...VALUE_COLOR);
    doc.setFontSize(VALUE_SIZE * MM_TO_PT);
    const lines = label === "Address"
      ? (doc.splitTextToSize(value || "—", fw) as string[]).slice(0, 2)
      : [fit(doc, value || "—", fw)];
    lines.forEach((line, i) => doc.text(line, fx, fy + 2.9 + i * 3.1));
    fy += 2.9 + lines.length * 3.1 + 1.2;
  }

  // Footer: student code, small and grey, bottom-right
  doc.setTextColor(...LABEL_COLOR);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(LABEL_SIZE * MM_TO_PT);
  doc.text(s.code, x + CARD_W - PAD, y + CARD_H - 1.6, { align: "right" });

  if (cutMarks) {
    // Cutting guides (bulk sheets only — a single card gets a clean edge)
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.rect(x, y, CARD_W, CARD_H, "S");
    cropMarks(doc, x, y);
  } else {
    doc.setDrawColor(201, 206, 211);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([], 0);
    doc.rect(x, y, CARD_W, CARD_H, "S");
  }
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

/**
 * Download the given students' ID cards as PDF(s): 10 cards per A4 page, at
 * most MAX_CARDS_PER_PDF per file (bigger batches download as several files).
 * Returns the number of cards rendered.
 */
export async function downloadIdCardsPdf(
  students: Student[], profile: Profile, _ctx: IdCardContext, design: IdCardDesign,
): Promise<number> {
  if (students.length === 0) return 0;

  const assets: Assets = {
    logo: (design.logo || profile.avatar) ? await logoPng(design.logo || profile.avatar) : null,
    photos: new Map(),
  };
  await Promise.all(students.map(async (s) => {
    assets.photos.set(s.id, s.photo ? await coverJpeg(s.photo, PHOTO_W / PHOTO_H) : null);
  }));

  for (let start = 0; start < students.length; start += MAX_CARDS_PER_PDF) {
    const chunk = students.slice(start, start + MAX_CARDS_PER_PDF);
    const doc = new jsPDF("p", "mm", "a4");
    chunk.forEach((s, i) => {
      const slot = i % (COLS * ROWS);
      if (i > 0 && slot === 0) doc.addPage("a4", "p");
      const x = MARGIN_X + (slot % COLS) * (CARD_W + GAP_X);
      const y = MARGIN_Y + Math.floor(slot / COLS) * (CARD_H + GAP_Y);
      drawCard(doc, x, y, s, profile, design, assets, students.length > 1);
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

export function previewIdCardHtml(s: Student, profile: Profile, _ctx: IdCardContext, design: IdCardDesign): string {
  const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
  const brand = (design.companyName || profile.businessName || "Institute").toUpperCase();
  const website = design.website || profile.website;
  const logo = design.logo || profile.avatar;
  const rows = fieldsFor(s, profile, design);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { background: #f4f4f2; display: flex; justify-content: center; padding: 12px; }
    .card {
      width: 88mm; height: 56mm; border: 0.25mm solid #c9ced3;
      overflow: hidden; display: flex; flex-direction: column; position: relative;
      background: ${design.cardBg};
    }
    .band { display: flex; align-items: center; height: 10mm; flex-shrink: 0; background: ${design.headerBg}; color: ${design.headerText}; padding: 0 3mm; }
    .band img.logo { height: 7.5mm; width: auto; max-width: 20mm; margin-right: 3mm; object-fit: contain; }
    .band-text { min-width: 0; line-height: 1.15; }
    .biz { font-size: 2.7mm; font-weight: 700; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tag { font-size: 1.8mm; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .web { font-size: 1.8mm; font-style: italic; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .body { flex: 1; display: flex; gap: 3mm; padding: 3mm; min-height: 0; }
    .photo {
      width: 22mm; height: 28mm; border: 0.75mm solid #000; background: #eef0f3; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      font-size: 7mm; font-weight: 700; color: #969ba5;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .fields { flex: 1; min-width: 0; }
    .field { margin-bottom: 1.2mm; }
    .k { font-size: 1.8mm; font-weight: 700; letter-spacing: 0.1mm; text-transform: uppercase; color: #6c7680; line-height: 1.1; }
    .v { font-size: 2.7mm; font-weight: 700; color: #1a1f26; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .v.wrap { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .foot { position: absolute; right: 3mm; bottom: 1mm; font-size: 1.8mm; color: #6c7680; }
  </style></head><body>
  <div class="card">
    <div class="band">
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="" />` : ""}
      <div class="band-text">
        <div class="biz">${esc(brand)}</div>
        ${design.tagline ? `<div class="tag">${esc(design.tagline)}</div>` : ""}
        ${website ? `<div class="web">${esc(website)}</div>` : ""}
      </div>
    </div>
    <div class="body">
      <div class="photo">${s.photo ? `<img src="${esc(s.photo)}" alt="" />` : `<span>${esc(initials)}</span>`}</div>
      <div class="fields">
        ${rows.map(([k, v]) => `<div class="field"><div class="k">${k}</div><div class="v${k === "Address" ? " wrap" : ""}">${esc(v) || "—"}</div></div>`).join("")}
      </div>
    </div>
    <div class="foot">${esc(s.code)}</div>
  </div>
  </body></html>`;
}
