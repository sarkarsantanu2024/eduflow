"use server";

import { put } from "@vercel/blob";
import { requireActiveInstituteId } from "@/lib/tenant";

/**
 * Upload an image and return its URL.
 *  - Production (BLOB_READ_WRITE_TOKEN set): stored in Vercel Blob, returns a
 *    public CDN URL — keeps large images out of the database.
 *  - Local dev (no token): falls back to a data URL so uploads still work.
 */
export async function uploadImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected" };
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file" };
  if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB" };

  const instituteId = await requireActiveInstituteId();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ext = (file.name.split(".").pop() || "img").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `${instituteId}/${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}.${ext}`;
    const blob = await put(key, file, { access: "public", contentType: file.type });
    return { url: blob.url };
  }

  // Fallback: data URL (local dev without a Blob store).
  const buf = Buffer.from(await file.arrayBuffer());
  return { url: `data:${file.type};base64,${buf.toString("base64")}` };
}
