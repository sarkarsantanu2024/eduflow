"use server";

import { put } from "@vercel/blob";
import { requireActiveInstituteId } from "@/lib/tenant";

/**
 * Upload an image and return its URL.
 *  - Production (BLOB_READ_WRITE_TOKEN set): stored in Vercel Blob, returns a
 *    public CDN URL — keeps large images out of the database.
 *  - Local dev (no token): falls back to a data URL so uploads still work.
 */
/**
 * Raster formats only. SVG is deliberately absent: it is an XML document that
 * can carry script, and `file.type` is supplied by the browser, so allowing
 * anything matching /^image\// let a caller store an active document under an
 * image content type.
 */
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Leading bytes → real type. The declared MIME is a hint; this is the truth. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function uploadImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected" };
  if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB" };

  const instituteId = await requireActiveInstituteId();

  // Read the bytes and decide from those, not from the declared type.
  const buf = Buffer.from(await file.arrayBuffer());
  const actual = sniff(new Uint8Array(buf.subarray(0, 12)));
  if (!actual || !ALLOWED.has(actual)) {
    return { error: "Please choose a JPG, PNG or WebP image." };
  }
  const ext = ALLOWED.get(actual)!;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // The original filename is never reused — only our own generated key.
    const key = `${instituteId}/${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}.${ext}`;
    const blob = await put(key, buf, { access: "public", contentType: actual });
    return { url: blob.url };
  }

  // Fallback: data URL (local dev without a Blob store).
  return { url: `data:${actual};base64,${buf.toString("base64")}` };
}
