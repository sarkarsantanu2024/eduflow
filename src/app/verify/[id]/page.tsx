import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { BadgeCheck, ShieldX } from "lucide-react";
import { db } from "@/lib/db";
import { certificates, institutes } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

/**
 * Public certificate verification. A parent or employer scans the QR printed on
 * a certificate and lands here; we confirm the serial is genuine.
 *
 * This is a SERVER component doing a direct lookup, and that is the whole
 * point. It used to be a client component reading `useCollection("certificates")`
 * — the signed-in user's hydrated store — so anyone without a session (i.e.
 * every parent and every employer who has ever scanned one of these codes) saw
 * an empty store and was told the certificate was not genuine. The advertised
 * feature never worked for its actual audience.
 *
 * Deliberately NOT tenant-scoped: the whole purpose is verification by an
 * outsider, and `certificates_serial_unique` makes the serial globally unique,
 * so there is nothing to disambiguate. Only the fields already printed on the
 * certificate are returned, plus the issuing center's name — the point of
 * verification is confirming who issued it. No contact details, no student id,
 * nothing that isn't already on the paper in the holder's hand.
 */

export const dynamic = "force-dynamic";

// Per-student pages carrying a child's name must never be indexed. robots.txt
// disallows /verify/ as well; this is the belt to that braces.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Verify certificate",
};

type Verified = {
  studentName: string;
  title: string;
  course: string;
  serial: string;
  issueDate: string | null;
  centerName: string;
};

async function lookup(serial: string): Promise<Verified | null> {
  // Serials are short printed strings; cap the length so a long URL can't be
  // used to probe the database.
  if (!serial || serial.length > 64) return null;

  const [row] = await db
    .select({
      studentName: certificates.studentName,
      title: certificates.title,
      course: certificates.course,
      serial: certificates.serial,
      issueDate: certificates.issueDate,
      centerName: institutes.name,
    })
    .from(certificates)
    .innerJoin(institutes, eq(certificates.instituteId, institutes.id))
    // A revoked (trashed) certificate must not verify.
    .where(and(eq(certificates.serial, serial), isNull(certificates.deletedAt)))
    .limit(1);

  return row ?? null;
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await lookup(id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        {cert ? (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <BadgeCheck className="size-8" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Certificate verified</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This is a genuine certificate issued by {cert.centerName}.
            </p>
            <dl className="mt-6 space-y-2 text-left text-sm">
              <Row label="Name" value={cert.studentName} />
              <Row label="Certificate" value={cert.title} />
              <Row label="Course" value={cert.course || "—"} />
              <Row label="Issued by" value={cert.centerName} />
              <Row label="Serial" value={cert.serial} />
              <Row label="Issued" value={cert.issueDate ? formatDate(cert.issueDate) : "—"} />
            </dl>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldX className="size-8" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              No certificate matches serial <span className="font-mono">{id}</span>. Check the code printed on the
              certificate, or ask the center that issued it.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
