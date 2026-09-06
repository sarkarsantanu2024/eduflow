import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an amount in PAISE as Indian Rupee currency.
 *
 * Careful: the database stores money in WHOLE RUPEES (every `amount` column is
 * an integer of rupees — see src/lib/db/schema.ts). So callers holding a value
 * straight from the store must pass `amount * 100`, which is why you will see
 * that multiplication at every call site, and an `r()` helper doing it in
 * bulk on the dashboard.
 *
 * This is a wart, not a bug — the units are consistent everywhere today. The
 * clean fix is to make this take rupees and drop the ×100 from all 42 call
 * sites, but that is a mechanical change across every money display in the
 * app and wants a visual pass to land safely.
 *
 * The genuinely dangerous part is gone: `toPaise()` / `toRupees()` used to sit
 * here, unused by anything, implying a paise-based storage model that does not
 * exist. Writing `toPaise(amount)` into an integer-rupee column would have
 * been a silent 100× error.
 */
export function formatCurrency(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

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
