"use client";

import { use } from "react";
import { BadgeCheck, ShieldX } from "lucide-react";
import { useCollection, useHydrated } from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";

/**
 * Public certificate verification. A parent/employer scans the QR on a
 * certificate and lands here; we confirm the serial is genuine.
 *
 * Demo note: certificates live in the browser store, so verification works on
 * the issuing device. Phase 3 (Neon backend) makes this verifiable from any
 * device via a public, server-side lookup.
 */
export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const certificates = useCollection("certificates");
  const cert = certificates.find((c) => c.serial === id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">Verifying…</p>
        ) : cert ? (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <BadgeCheck className="size-8" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Certificate verified</h1>
            <p className="mt-1 text-sm text-muted-foreground">This is a genuine certificate.</p>
            <dl className="mt-6 space-y-2 text-left text-sm">
              <Row label="Name" value={cert.studentName} />
              <Row label="Certificate" value={cert.title} />
              <Row label="Course" value={cert.course || "—"} />
              <Row label="Serial" value={cert.serial} />
              <Row label="Issued" value={formatDate(cert.issueDate)} />
            </dl>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldX className="size-8" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              No certificate matches serial <span className="font-mono">{id}</span> on this device.
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
