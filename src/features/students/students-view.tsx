"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Users, Sparkles } from "lucide-react";
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
  useCollection, useHydrated, useProfile, removeItem, loadSamples, type StudentStatus,
} from "@/lib/store/local-db";
import { getLabels } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

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
          <Button asChild>
            <Link href="/students/new"><Plus /> Add {member.toLowerCase()}</Link>
          </Button>
        }
      />

      {!hydrated ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${members.toLowerCase()} yet`}
          description={`Add your first ${member.toLowerCase()}, or load sample data to explore the app.`}
          action={
            <div className="flex gap-2">
              <Button asChild><Link href="/students/new"><Plus /> Add {member.toLowerCase()}</Link></Button>
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
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
