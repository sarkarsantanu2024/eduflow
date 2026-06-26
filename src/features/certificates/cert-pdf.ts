"use client";

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Certificate, Profile } from "@/lib/store/local-db";

/**
 * Renders a certificate by compositing the customer's uploaded blank template
 * image with auto-filled student data (and a verify QR) onto a canvas, then
 * exports one or many as a downloadable PDF.
 *
 * Field sizes are expressed relative to a 1000px-wide reference so the same
 * layout looks right on any certificate image resolution (and matches the
 * live preview in the designer exactly).
 */

export function verifyUrl(serial: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify/${serial}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const fmtDate = (d: string) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

/** Draw one certificate onto a canvas using the profile's template + layout. */
export async function renderCertCanvas(cert: Certificate, profile: Profile): Promise<HTMLCanvasElement | null> {
  if (!profile.certImage) return null;
  const img = await loadImage(profile.certImage);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1000;
  canvas.height = img.naturalHeight || 700;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const L = profile.certLayout;
  const scale = canvas.width / 1000;
  ctx.fillStyle = L.color || "#1f2937";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const put = (text: string, pos: { x: number; y: number; size: number }, bold = false) => {
    if (!text) return;
    ctx.font = `${bold ? "bold " : ""}${Math.round(pos.size * scale)}px Georgia, "Times New Roman", serif`;
    ctx.fillText(text, (pos.x / 100) * canvas.width, (pos.y / 100) * canvas.height);
  };

  put(cert.studentName, L.name, true);
  put(cert.title || cert.course, L.course);
  put(fmtDate(cert.issueDate), L.date);
  put(cert.serial, L.serial);

  if (L.qr.show) {
    const qrData = await QRCode.toDataURL(verifyUrl(cert.serial), { margin: 1, width: 300 });
    const qrImg = await loadImage(qrData);
    const qrPx = L.qr.size * scale;
    ctx.drawImage(qrImg, (L.qr.x / 100) * canvas.width - qrPx / 2, (L.qr.y / 100) * canvas.height - qrPx / 2, qrPx, qrPx);
  }

  return canvas;
}

function canvasToDoc(canvases: HTMLCanvasElement[]): jsPDF | null {
  const first = canvases[0];
  if (!first) return null;
  const orient = (c: HTMLCanvasElement) => (c.width >= c.height ? "l" : "p");
  const doc = new jsPDF(orient(first), "px", [first.width, first.height]);
  doc.addImage(first.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, first.width, first.height);
  for (let i = 1; i < canvases.length; i++) {
    const c = canvases[i];
    if (!c) continue;
    doc.addPage([c.width, c.height], orient(c));
    doc.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, c.width, c.height);
  }
  return doc;
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

/** Download a single certificate as a PDF. Returns false if no template set. */
export async function downloadCertPdf(cert: Certificate, profile: Profile): Promise<boolean> {
  const canvas = await renderCertCanvas(cert, profile);
  if (!canvas) return false;
  const doc = canvasToDoc([canvas]);
  doc?.save(`certificate-${safe(cert.studentName)}-${cert.serial}.pdf`);
  return !!doc;
}

/** Download many certificates as one multi-page PDF. Returns count rendered. */
export async function downloadAllCertsPdf(certs: Certificate[], profile: Profile): Promise<number> {
  const canvases: HTMLCanvasElement[] = [];
  for (const cert of certs) {
    const c = await renderCertCanvas(cert, profile);
    if (c) canvases.push(c);
  }
  if (canvases.length === 0) return 0;
  const doc = canvasToDoc(canvases);
  doc?.save(`certificates-${certs.length}.pdf`);
  return canvases.length;
}
