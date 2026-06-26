"use client";

import { useState } from "react";
import { Award, Sparkles, Printer, QrCode, Download, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { CertDesigner } from "@/features/certificates/cert-designer";
import { downloadCertPdf, downloadAllCertsPdf } from "@/features/certificates/cert-pdf";
import {
  useCollection, useHydrated, useProfile, addItem, loadSamples, newId, type Certificate,
} from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";

/** Free QR image (same service used for UPI QR) — encodes the public verify URL. */
function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(data)}`;
}

function verifyUrl(serial: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/verify/${serial}`;
}

/** Open a print-ready certificate in a new window (Save as PDF from the print dialog). */
function printCertificate(cert: Certificate, biz: string) {
  const url = verifyUrl(cert.serial);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${cert.serial}</title>
  <style>
    *{box-sizing:border-box;font-family:Georgia,'Times New Roman',serif}
    body{margin:0;padding:40px;background:#fff;color:#1f2937}
    .cert{border:10px double #c2872a;border-radius:14px;padding:48px;text-align:center;max-width:820px;margin:0 auto}
    .biz{font-size:26px;font-weight:bold;letter-spacing:1px;color:#b45309}
    .title{font-size:18px;letter-spacing:6px;color:#6b7280;margin:18px 0 6px;text-transform:uppercase}
    .name{font-size:40px;font-weight:bold;margin:18px 0;color:#111827}
    .line{font-size:18px;color:#374151;margin:6px 0}
    .row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:48px}
    .serial{font-size:12px;color:#6b7280}
    .qr{text-align:center;font-size:11px;color:#6b7280}
  </style></head><body>
  <div class="cert">
    <div class="biz">${biz}</div>
    <div class="title">Certificate of Completion</div>
    <div class="line">This is to certify that</div>
    <div class="name">${cert.studentName}</div>
    <div class="line">has successfully completed</div>
    <div class="line"><strong>${cert.title}</strong></div>
    <div class="row">
      <div style="text-align:left">
        <div class="line" style="border-top:1px solid #9ca3af;padding-top:6px;min-width:160px">Authorised Signatory</div>
        <div class="serial">Issued: ${formatDate(cert.issueDate)}</div>
      </div>
      <div class="qr">
        <img src="${qrUrl(url)}" width="120" height="120" alt="verify" /><br/>
        Scan to verify<br/><span class="serial">${cert.serial}</span>
      </div>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=900,height=650");
  if (w) { w.document.write(html); w.document.close(); }
}

export function CertificatesView() {
  const hydrated = useHydrated();
  const certificates = useCollection("certificates");
  const students = useCollection("students");
  const courses = useCollection("courses");
  const profile = useProfile();
  const biz = profile.businessName || "Your Institute";
  const hasTemplate = !!profile.certImage;
  const [showDesigner, setShowDesigner] = useState(false);

  // Use the customer's branded PDF template when uploaded; else the built-in print.
  async function download(c: Certificate) {
    if (hasTemplate) {
      const ok = await downloadCertPdf(c, profile);
      if (ok) { toast.success("Certificate PDF downloaded"); return; }
    }
    printCertificate(c, biz);
  }

  async function downloadAll() {
    if (!hasTemplate) { toast.error("Upload a certificate template first to bulk-download PDFs"); return; }
    toast.message("Preparing PDF…");
    const n = await downloadAllCertsPdf(certificates, profile);
    if (n) toast.success(`Downloaded ${n} certificate${n > 1 ? "s" : ""} in one PDF`);
  }

  const addBtn = (
    <FormDialog
      title="Issue certificate" submitLabel="Issue" successMessage="Certificate issued"
      description="Issue a verifiable certificate — print it or save as PDF, with a scannable verify QR."
      trigger={<Button><Award /> Issue certificate</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "course", label: "Course / level", type: "select",
          options: courses.map((c) => ({ value: c.name, label: c.name })) },
        { name: "title", label: "Certificate title", required: true, placeholder: "DCA — Completion" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        if (!s) return;
        const seq = String(certificates.length + 1).padStart(4, "0");
        addItem<Certificate>("certificates", {
          id: newId("cert"), serial: `EF-2026-${seq}`, studentId: s.id,
          studentName: `${s.firstName} ${s.lastName}`.trim(),
          title: v("title"), course: v("course"), issueDate: new Date().toISOString().slice(0, 10),
        });
      }}
    />
  );

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setShowDesigner((v) => !v)}>
        <Settings2 /> {showDesigner ? "Hide design" : "Design template"}
      </Button>
      {certificates.length > 0 && (
        <Button variant="outline" onClick={downloadAll}><Download /> Download all (PDF)</Button>
      )}
      {addBtn}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="Upload your branded blank certificate — EduFlow auto-fills each student and gives a downloadable PDF." actions={headerActions} />

      {showDesigner && <CertDesigner />}

      {!hydrated ? null : certificates.length === 0 ? (
        <EmptyState
          icon={Award} title="No certificates yet"
          description="Issue a course/level completion certificate with online verification."
          action={
            <div className="flex gap-2">
              {addBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <Award className="size-5" />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl(verifyUrl(c.serial))} alt="verify QR" className="size-14 rounded border bg-white" />
                </div>
                <div>
                  <h3 className="font-bold">{c.studentName}</h3>
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.serial} · {formatDate(c.issueDate)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => download(c)}>
                    {hasTemplate ? <><Download /> PDF</> : <><Printer /> Print / PDF</>}
                  </Button>
                  <Button size="sm" variant="outline" aria-label="Verify" asChild>
                    <a href={verifyUrl(c.serial)} target="_blank" rel="noopener noreferrer"><QrCode /></a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
