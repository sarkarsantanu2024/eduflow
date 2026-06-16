import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format paise (integer) as Indian Rupee currency. */
export function formatCurrency(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Rupees (number from a form) → paise (integer for storage). */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
/** Paise (integer) → rupees (number for display in inputs). */
export const toRupees = (paise: number) => paise / 100;

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** Build a public storage object path: <institute_id>/<entity>/<filename>. */
export function storagePath(instituteId: string, entity: string, filename: string): string {
  return `${instituteId}/${entity}/${filename}`;
}

/** Substitute {{var}} tokens in a template body. */
export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`
  );
}
