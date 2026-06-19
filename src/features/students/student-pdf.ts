import type { Student } from "@/lib/store/local-db";

/**
 * Extracts student details + photo from a (digitally generated) PDF using pdf.js.
 * Text fields come from the PDF text layer; the photo is the largest embedded
 * image. Scanned/flat PDFs have no text layer — those need vision OCR instead.
 */
export type ExtractedStudent = { data: Partial<Omit<Student, "id">>; photo: string; rawText: string };

export async function extractStudentFromPdf(file: File): Promise<ExtractedStudent> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  let text = "";
  let bestImage: { dataUrl: string; area: number } | null = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);

    // ── text layer ──
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";

    // ── embedded images (pick the largest as the photo) ──
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
      const name = ops.argsArray[i]?.[0];
      if (typeof name !== "string") continue;
      try {
        const img = await getImage(page, name);
        const dataUrl = img && imageToDataUrl(img);
        if (img && dataUrl) {
          const area = img.width * img.height;
          if (!bestImage || area > bestImage.area) bestImage = { dataUrl, area };
        }
      } catch {
        /* skip unreadable image */
      }
    }
  }

  return { data: mapFields(text), photo: bestImage?.dataUrl ?? "", rawText: text };
}

/* ── helpers ─────────────────────────────────────────────────── */

type PdfImage = { width: number; height: number; data?: Uint8ClampedArray | Uint8Array; bitmap?: ImageBitmap };

function getImage(page: { objs: PdfObjs; commonObjs: PdfObjs }, name: string): Promise<PdfImage | null> {
  return new Promise((resolve) => {
    const store = page.objs.has?.(name) ? page.objs : page.commonObjs;
    try {
      store.get(name, (img: PdfImage) => resolve(img ?? null));
    } catch {
      resolve(null);
    }
  });
}
type PdfObjs = { has?: (n: string) => boolean; get: (n: string, cb: (img: PdfImage) => void) => void };

function imageToDataUrl(img: PdfImage): string | null {
  const { width, height } = img;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const src = img.data;
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (src.length === width * height * 4) {
      rgba.set(src);
    } else if (src.length === width * height * 3) {
      for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
        rgba[j] = src[i]!; rgba[j + 1] = src[i + 1]!; rgba[j + 2] = src[i + 2]!; rgba[j + 3] = 255;
      }
    } else if (src.length === width * height) {
      for (let i = 0, j = 0; i < src.length; i++, j += 4) {
        rgba[j] = rgba[j + 1] = rgba[j + 2] = src[i]!; rgba[j + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return null;
  }
  // Ignore tiny logos/icons — a real photo is reasonably sized.
  if (width < 60 || height < 60) return null;
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Best-effort label → field mapping from the extracted text. */
function mapFields(text: string): Partial<Omit<Student, "id">> {
  const t = text.replace(/\s+/g, " ");
  const after = (labels: string) => {
    const re = new RegExp(`(?:${labels})\\s*[:\\-]?\\s*([^\\n]{2,40}?)(?=\\s{2,}|\\b(?:name|father|mother|mobile|phone|contact|dob|date|school|class|address|city|pin|email|gender)\\b|$)`, "i");
    return (t.match(re)?.[1] ?? "").trim().replace(/[|:;]+$/, "").trim();
  };
  const digits = (labels: string) => (t.match(new RegExp(`(?:${labels})[^0-9]*([0-9]{10})`, "i"))?.[1] ?? "").trim();
  const date = (labels: string) => {
    const m = t.match(new RegExp(`(?:${labels})[^0-9]*([0-3]?\\d[\\/.\\-][01]?\\d[\\/.\\-]\\d{2,4})`, "i"))?.[1];
    return m ? normalizeDate(m) : "";
  };

  const fullName = after("student\\s*name|name of (?:the )?student|student|name");
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

  const data: Partial<Omit<Student, "id">> = {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    dob: date("d\\.?o\\.?b\\.?|date of birth"),
    fatherName: after("father'?s?\\s*name|father"),
    motherName: after("mother'?s?\\s*name|mother"),
    fatherContact: digits("father'?s?\\s*(?:mobile|contact|phone)|mobile|contact|phone|whatsapp"),
    schoolName: after("school'?s?\\s*name|school"),
    schoolClass: after("class|standard|grade"),
    address: after("address"),
    city: after("city|town"),
    pincode: (t.match(/(?:pin|pincode|postal)\D*(\d{6})/i)?.[1] ?? ""),
    parentEmail: (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ""),
  };
  const gender = t.match(/\b(male|female|other)\b/i)?.[1];
  if (gender) data.gender = gender.toLowerCase() as Student["gender"];
  return data;
}

function normalizeDate(d: string): string {
  const parts = d.split(/[\/.\-]/).map((x) => x.trim());
  if (parts.length !== 3) return "";
  let [dd, mm, yy] = parts;
  if (yy!.length === 2) yy = (Number(yy) > 50 ? "19" : "20") + yy;
  // assume DD/MM/YYYY (Indian forms); swap if first looks like a year
  if (dd!.length === 4) [dd, yy] = [yy!, dd!];
  return `${yy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
}
