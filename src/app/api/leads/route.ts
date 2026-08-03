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
 * The marketing site is hosted on a different domain, so CORS is open for POST.
 * Nothing sensitive is exposed: this endpoint only ever writes.
 */

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

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
