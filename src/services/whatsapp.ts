import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * Thin WhatsApp Cloud API client. Sends a template or free-form text message
 * and returns the provider message id used to correlate delivery webhooks.
 */
export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  const env = getServerEnv();
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[^\d]/g, ""),
          type: "text",
          text: { body },
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? "send failed" };
    return { ok: true, messageId: json?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Send an approved WhatsApp template (required for business-initiated msgs
 * outside the 24h window). `components` carries the body variables.
 */
export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  language?: string;
  bodyParams?: string[];
}): Promise<WhatsAppSendResult> {
  const env = getServerEnv();
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const components = params.bodyParams?.length
    ? [{ type: "body", parameters: params.bodyParams.map((text) => ({ type: "text", text })) }]
    : undefined;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to.replace(/[^\d]/g, ""),
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.language ?? "en" },
            components,
          },
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message ?? "send failed" };
    return { ok: true, messageId: json?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}
