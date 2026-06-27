"use client";

import { uploadImage } from "./actions";

/** Upload an image File and resolve to its stored URL (Blob or data-URL fallback). */
export async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await uploadImage(fd);
  if (res.error || !res.url) throw new Error(res.error || "Upload failed");
  return res.url;
}
