/**
 * Best-effort auto-crop of an uploaded payment screenshot down to just the QR
 * square. Uses the browser-native BarcodeDetector (Chrome/Edge/Android). If it's
 * unavailable, or no QR is found, the original file is returned unchanged — so
 * this can never break an upload, only improve it.
 */

type DetectedBarcode = { boundingBox: { x: number; y: number; width: number; height: number } };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (source: ImageBitmap) => Promise<DetectedBarcode[]>;
};

export async function cropToQrCode(file: File): Promise<File> {
  try {
    const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
    if (!w.BarcodeDetector || typeof createImageBitmap !== "function") return file;

    const bitmap = await createImageBitmap(file);
    const detector = new w.BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(bitmap);
    const first = codes[0];
    if (!first) { bitmap.close?.(); return file; }

    // Pad around the QR for the required "quiet zone".
    const box = first.boundingBox;
    const pad = Math.round(Math.max(box.width, box.height) * 0.14);
    const x = Math.max(0, Math.floor(box.x - pad));
    const y = Math.max(0, Math.floor(box.y - pad));
    const right = Math.min(bitmap.width, Math.ceil(box.x + box.width + pad));
    const bottom = Math.min(bitmap.height, Math.ceil(box.y + box.height + pad));
    const cw = right - x;
    const ch = bottom - y;
    if (cw < 20 || ch < 20) { bitmap.close?.(); return file; }

    // Draw into a square white tile so the QR sits centred and scannable.
    const size = Math.max(cw, ch);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bitmap, x, y, cw, ch, Math.floor((size - cw) / 2), Math.floor((size - ch) / 2), cw, ch);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return file;
    return new File([blob], "payment-qr.png", { type: "image/png" });
  } catch {
    return file; // any failure → keep the original upload
  }
}
