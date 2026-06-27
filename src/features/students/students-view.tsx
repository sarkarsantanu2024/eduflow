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
import { studentTemplateCsv, parseStudentsFromSheet } from "@/features/students/student-csv";
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
  const profile = useProfile();
  const { member, members } = getLabels(profile.businessType);
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

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    const tId = toast.loading("Reading file…");
    try {
      // Read CSV or Excel uniformly via SheetJS (lazy-loaded).
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
      if (!ws) { toast.error("The file has no sheets.", { id: tId }); return; }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const records = parseStudentsFromSheet(rows);
      if (!records.length) {
        toast.error("No student rows found. The file needs at least a Name or Phone column.", { id: tId });
        return;
      }
      // Auto-generate a code per student (prefix from the center name), keep all rows.
      const prefix = (profile.businessName || "STU").split(/\s+/).map((w) => w[0]).join("").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "STU";
      let n = students.length;
      records.forEach((r) => {
        n += 1;
        const code = r.code || `${prefix}-${String(n).padStart(4, "0")}`;
        addItem<Student>("students", { id: newId("student"), ...r, code });
      });
      toast.success(`Imported ${records.length} ${members.toLowerCase()}`, {
        id: tId,
        description: "Missing details (level, fees, photo…) can be filled in per student.",
      });
      setPage(1);
    } catch {
      toast.error("Could not read the file. Use a .csv or .xlsx file.", { id: tId });
    }
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
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onImport} />
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={onImportPdf} />
            <Button variant="outline" onClick={() => downloadFile("eduflow-students-template.csv", studentTemplateCsv())}>
              <Download /> Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload /> Import Excel/CSV
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
