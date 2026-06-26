/**
 * Free, zero-cost WhatsApp "click-to-send".
 *
 * `waLink()` builds a wa.me deep link with the message pre-filled. Tapping it
 * opens WhatsApp (app or web) with the text ready — the owner just presses send,
 * from their own number, at ₹0 and with no Meta approval.
 *
 * This is the ONE seam the product sends through today. When you move to the
 * official WhatsApp Cloud API later (auto-send + the two-way "Fees Due" bot),
 * only `sendMessage()` changes — it points at `src/services/whatsapp.ts`.
 */

/** Normalise an Indian mobile to wa.me's country-coded, digits-only form. */
export function waPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  // 10-digit local → prefix 91; already-prefixed (12 digits) → keep.
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/** Build a https://wa.me link that opens WhatsApp with `text` pre-filled. */
export function waLink(phone: string, text: string): string {
  const to = waPhone(phone);
  const msg = encodeURIComponent(text);
  return to ? `https://wa.me/${to}?text=${msg}` : `https://wa.me/?text=${msg}`;
}

/** Fill {{placeholders}} in a template body. Unknown keys are left intact. */
export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}
