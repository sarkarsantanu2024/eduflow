"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Users, Upload, Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, useProfile, addItem, removeItem, newId,
  type StudentStatus, type Student,
} from "@/lib/store/local-db";
import { getLabels } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { downloadFile } from "@/lib/csv";
import { studentTemplateCsv, parseStudentsCsv } from "@/features/students/student-csv";
import { extractStudentFromPdf } from "@/features/students/student-pdf";

const statusVariant: Record<StudentStatus, "success" | "secondary" | "warning" | "destructive"> = {
  active: "success", inactive: "secondary", graduated: "warning", dropped: "destructive",
};

const PAGE_SIZE = 10;

export function StudentsView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const students = useCollection("students");
  const courses = useCollection("courses");
  const { member, members } = getLabels(useProfile().businessType);
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "—";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  // Extract a student (fields + photo) from a digital PDF form, then open the
  // edit page pre-filled for review. (Scanned/flat PDFs need vision OCR.)
  async function onImportPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const tId = toast.loading("Extracting from PDF…");
    try {
      const { data, photo, rawText } = await extractStudentFromPdf(file);
      if (!rawText.trim() && !photo) {
        toast.error("Couldn't read this PDF — it may be a scanned image. Use a digital form or Import CSV.", { id: tId });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const draft: Student = {
        id: newId("student"),
        code: `MMA-${String(students.length + 1).padStart(4, "0")}`,
        firstName: "", lastName: "", gender: "", dob: "", admissionDate: today,
        courseId: "", batchId: "", monthlyFee: 0, centreName: "", hobbies: "", siblingAge: "",
        schoolName: "", schoolClass: "", address: "", city: "", pincode: "",
        fatherName: "", fatherContact: "", motherName: "", motherContact: "",
        parentName: "", parentMobile: "", parentEmail: "", status: "active",
        ...data,
        photo: photo || "",
      };
      draft.parentName = draft.fatherName || draft.motherName || "";
      draft.parentMobile = draft.fatherContact || draft.motherContact || "";
      addItem<Student>("students", draft);
      toast.success("Details extracted — review & save", { id: tId, description: file.name });
      router.push(`/students/${draft.id}/edit`);
    } catch {
      toast.error("Could not process the PDF.", { id: tId });
    }
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = parseStudentsCsv(String(reader.result));
        if (!records.length) { toast.error("No rows found — check the template format"); return; }
        // Skip blanks (junk) and duplicate student IDs (existing or repeated in-file).
        const existing = new Set(students.map((s) => s.code.trim().toLowerCase()).filter(Boolean));
        const seen = new Set<string>();
        let imported = 0, skipped = 0;
        records.forEach((r) => {
          const code = r.code.trim().toLowerCase();
          if (!r.firstName.trim() && !code) { skipped += 1; return; }
          if (code && (existing.has(code) || seen.has(code))) { skipped += 1; return; }
          if (code) seen.add(code);
          addItem<Student>("students", { id: newId("student"), ...r });
          imported += 1;
        });
        toast.success(
          `Imported ${imported} ${members.toLowerCase()}`,
          skipped ? { description: `Skipped ${skipped} duplicate/blank row${skipped > 1 ? "s" : ""}` } : undefined,
        );
        setPage(1);
      } catch {
        toast.error("Could not read the file. Use the CSV template.");
      }
    };
    reader.readAsText(file);
  }

  const filtered = students.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [s.firstName, s.lastName, s.code, s.parentMobile, s.fatherContact]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title={members}
        description="Manage admissions, search and export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onImport} />
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={onImportPdf} />
            <Button variant="outline" onClick={() => downloadFile("eduflow-students-template.csv", studentTemplateCsv())}>
              <Download /> Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload /> Import CSV
            </Button>
            <Button variant="outline" onClick={() => pdfRef.current?.click()}>
              <FileText /> Import PDF
            </Button>
            <Button asChild>
              <Link href="/students/new"><Plus /> Add {member.toLowerCase()}</Link>
            </Button>
          </div>
        }
      />

      {!hydrated ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${members.toLowerCase()} yet`}
          description={`Add your first ${member.toLowerCase()}.`}
          action={
            <div className="flex gap-2">
              <Button asChild><Link href="/students/new"><Plus /> Add {member.toLowerCase()}</Link></Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, ID or mobile…"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
              value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">All statuses</option><option value="active">Active</option>
              <option value="inactive">Inactive</option><option value="graduated">Graduated</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead><TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Parent</TableHead><TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Admission</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No matches.</TableCell></TableRow>
                )}
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/students/${s.id}/edit`} className="hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{courseName(s.courseId)}</TableCell>
                    <TableCell>{s.parentName || s.fatherName || "—"}</TableCell>
                    <TableCell>{s.parentMobile || s.fatherContact || "—"}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">{s.address || "—"}</TableCell>
                    <TableCell>{s.admissionDate ? formatDate(s.admissionDate) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant[s.status]}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => router.push(`/students/${s.id}/edit`)}>
                          <Pencil />
                        </Button>
                        <ConfirmDialog
                          title={`Delete ${s.firstName}?`}
                          description="This permanently removes the student record."
                          confirmLabel="Delete" destructive
                          onConfirm={() => { removeItem("students", s.id); toast.success("Student deleted"); }}
                          trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} {members.toLowerCase()}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
