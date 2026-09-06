import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";

/**
 * PUBLIC lead-capture endpoint for the marketing site's "Book your free demo"
 * form (marketing-site/index.html). No authentication — anyone can submit an
 * enquiry, exactly like any contact form. Reading them requires super-admin
 * (see /admin/leads).
 *
 * CORS is locked to our own origin. It used to be "*" because the marketing
 * site was hosted separately; site.html is now served same-origin by the
 * rewrite in next.config.ts, so the wildcard bought nothing and let any page
 * on the web post into this table.
 */

export const dynamic = "force-dynamic";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://eduflow.nexvoratechnologies.co.in";

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/**
 * Per-IP rate limit. In-memory, so it resets on cold start and is per-instance
 * — not a shield against a distributed flood, but enough to stop one script
 * filling the leads table faster than a human could ever submit. Move to Vercel
 * KV if this ever needs to be authoritative.
 */
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k);
  }
  return recent.length > RATE_LIMIT.max;
}

const LeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  centerName: z.string().trim().max(160).optional().default(""),
  centerType: z.string().trim().max(80).optional().default(""),
  students: z.coerce.number().int().min(0).max(100000).optional(),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().default(""),
  source: z.string().trim().max(40).optional().default("website"),
  /** Honeypot — real people never fill this; bots do. */
  company: z.string().max(200).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many enquiries from this connection. Please try again shortly, or message us on WhatsApp." },
      { status: 429, headers: CORS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400, headers: CORS });
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the details and try again.", issues: parsed.error.flatten().fieldErrors },
      { status: 422, headers: CORS },
    );
  }

  const lead = parsed.data;

  // Silently accept and drop anything that trips the honeypot, so bots get no
  // signal that they were caught.
  if (lead.company) return NextResponse.json({ ok: true }, { status: 201, headers: CORS });

  try {
    await db.insert(leads).values({
      name: lead.name,
      centerName: lead.centerName,
      centerType: lead.centerType,
      students: lead.students ?? null,
      phone: lead.phone,
      email: lead.email || null,
      city: lead.city || null,
      message: lead.message,
      source: lead.source || "website",
    });
  } catch (e) {
    console.error("[leads] insert failed", e);
    return NextResponse.json({ error: "Could not save right now." }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: CORS });
}
