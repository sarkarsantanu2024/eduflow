"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import {
  useCollection, useProfile, addItem, updateItem, newId, effectiveFee, type Student, type Fee,
} from "@/lib/store/local-db";
import { uploadImageFile } from "@/features/uploads/upload-client";
import { checkStudentCapacityAction } from "@/features/data/actions";
import { getLabels } from "@/lib/constants";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const blank: Omit<Student, "id"> = {
  code: "", firstName: "", lastName: "", gender: "", dob: "", admissionDate: "",
  courseId: "", batchId: "", monthlyFee: 0, centreName: "", hobbies: "", siblingAge: "",
  schoolName: "", schoolClass: "", address: "", city: "", pincode: "",
  fatherName: "", fatherContact: "", motherName: "", motherContact: "",
  parentName: "", parentMobile: "", parentEmail: "", photo: "", status: "active",
};

export function StudentStoreForm({ studentId }: { studentId?: string }) {
  const router = useRouter();
  const students = useCollection("students");
  const courses = useCollection("courses");
  const batches = useCollection("batches");
  const profile = useProfile();
  const { member } = getLabels(profile.businessType);
  const profileMonthlyFee = profile.monthlyFee || 0;
  const profileAdmissionFee = profile.admissionFee || 0;
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const monthLabel = new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });
  // Whether to collect the first month up front at admission ("advance").
  const [advanceMonth, setAdvanceMonth] = useState(true);

  const existing = studentId ? students.find((s) => s.id === studentId) : undefined;
  const [form, setForm] = useState<Omit<Student, "id">>(existing ? { ...existing } : blank);
  // One-time admission fee raised at admission. Blank = use the centre default;
  // editable so an owner can waive it (0) or adjust for a specific admission.
  const [admissionFee, setAdmissionFee] = useState<number | "">("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const tId = toast.loading("Uploading photo…");
    try {
      const url = await uploadImageFile(file);
      set("photo", url);
      toast.success("Photo uploaded", { id: tId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: tId });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.firstName.trim()) {
      toast.error("Student ID and First name are required");
      return;
    }
    if (!form.photo) {
      toast.error("Student photo is required", { description: "Tap the camera icon at the top of the form to upload one — it's used on the ID card." });
      return;
    }
    // Capacity is prepaid — check before writing so the owner gets a clear
    // message instead of an optimistic row that silently disappears.
    if (!existing) {
      const check = await checkStudentCapacityAction(1);
      if (!check.ok) {
        toast.error("Student limit reached", { description: check.reason, duration: 10000 });
        router.push("/students/new");   // shows the seat-pack screen
        return;
      }
    }
    // sync parent fields for reminders/fees
    const payload = {
      ...form,
      centreName: profile.businessName || form.centreName,
      parentName: form.parentName || form.fatherName || form.motherName,
      parentMobile: form.parentMobile || form.fatherContact || form.motherContact,
    };
    if (existing) {
      updateItem<Student>("students", existing.id, payload);
      toast.success("Student updated");
    } else {
      const sid = newId("student");
      const name = `${payload.firstName} ${payload.lastName}`.trim();
      addItem<Student>("students", { id: sid, ...payload });

      // Admission collection for the NEW student only. Because this runs solely at
      // creation (never in a background sweep), existing students are never charged
      // retroactively. Two independent line items so the money is tracked correctly:
      //   1) Admission fee — one-time (e.g. ₹1500). Blank → centre default; 0 → waive.
      //   2) First month "advance" — this month's monthly fee (e.g. ₹500), paid up
      //      front. Same shape/period as the monthly auto-post, which dedupes by
      //      (studentId, period), so it's never billed twice.
      const admFee = admissionFee === "" ? profileAdmissionFee : admissionFee;
      const firstMonth = advanceMonth ? effectiveFee(payload, profile.monthlyFee || 0) : 0;
      if (admFee > 0) {
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: sid, studentName: name,
          parentMobile: payload.parentMobile, kind: "other", period: "",
          title: "Admission Fee", type: "admission", amount: admFee, amountPaid: 0,
          status: "pending", dueDate: payload.admissionDate || today,
          reminderSentAt: "", approved: false, voucherSentAt: "",
        });
      }
      if (firstMonth > 0) {
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: sid, studentName: name,
          parentMobile: payload.parentMobile, kind: "monthly", period: ym,
          title: `${monthLabel} Monthly Fee`, type: "monthly", amount: firstMonth, amountPaid: 0,
          status: "pending", dueDate: `${ym}-05`,
          reminderSentAt: "", approved: false, voucherSentAt: "",
        });
      }
      const total = admFee + firstMonth;
      toast.success("Student added", total > 0 ? {
        description: `Raised ₹${total} to collect — admission ₹${admFee} + first month ₹${firstMonth}. See Fees.`,
      } : undefined);
    }
    router.push("/students");
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader
        title={existing ? `Edit ${member.toLowerCase()}` : `Add ${member.toLowerCase()}`}
        description="Create or update an admission record."
      />

      {/* Photo + identity */}
      <Card>
        <CardHeader><CardTitle>{member} details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-muted text-muted-foreground">
                {form.photo ? <img src={form.photo} alt="" className="size-20 object-cover" /> : <Camera className="size-7" />}
              </span>
              <label className="absolute -bottom-1 -right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border bg-card shadow">
                <Camera className="size-4" />
                <input type="file" accept="image/*" hidden onChange={onPhoto} />
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload the student&apos;s photo <span className="font-medium text-destructive">*</span> — required, and printed on the ID card.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Student ID *"><Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="MMA-0001" /></Field>
            <Field label="Status">
              <select className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value as Student["status"])}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option><option value="dropped">Dropped</option>
              </select>
            </Field>
            <Field label="First name *"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
            <Field label="Last name"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
            <Field label="Gender">
              <select className={selectClass} value={form.gender} onChange={(e) => set("gender", e.target.value as Student["gender"])}>
                <option value="">Select…</option><option value="male">Male</option>
                <option value="female">Female</option><option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date of birth"><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
            <Field label="Admission date"><Input type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} /></Field>
            <Field label="Centre name">
              <Input value={profile.businessName} readOnly className="cursor-not-allowed bg-muted/50" title="Your centre — change it in Profile" />
            </Field>
            <Field label="Course/Level">
              <select className={selectClass} value={form.courseId} onChange={(e) => set("courseId", e.target.value)}>
                <option value="">{courses.length === 0 ? "No levels yet — add them on the Levels page" : "Select course/level…"}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {courses.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Open <a href="/courses" className="font-medium text-primary underline">Levels</a> and click
                  “Load default levels” to add Basic, Kids&nbsp;1–4 and Level&nbsp;1–8 in one tap.
                </p>
              )}
            </Field>
            <Field label="Batch">
              <select className={selectClass} value={form.batchId} onChange={(e) => set("batchId", e.target.value)}>
                <option value="">Select batch…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Monthly fee (₹)">
              <Input type="number" value={form.monthlyFee || ""} onChange={(e) => set("monthlyFee", Number(e.target.value) || 0)}
                placeholder={`Center default (${profileMonthlyFee})`} />
            </Field>
            {!existing && (
              <Field label="Admission fee (₹)">
                <Input type="number" value={admissionFee}
                  onChange={(e) => setAdmissionFee(e.target.value === "" ? "" : Number(e.target.value) || 0)}
                  placeholder={profileAdmissionFee > 0 ? `Center default (${profileAdmissionFee})` : "No admission fee set"} />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={advanceMonth} onChange={(e) => setAdvanceMonth(e.target.checked)} className="size-3.5" />
                  Collect first month ({monthLabel}) in advance
                </label>
                <p className="mt-1 text-xs text-muted-foreground">Charged once now. Blank = centre default; 0 = waive.</p>
              </Field>
            )}
            <Field label="Hobbies"><Input value={form.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></Field>
            <Field label="Sibling age"><Input value={form.siblingAge} onChange={(e) => set("siblingAge", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      {/* School + address */}
      <Card>
        <CardHeader><CardTitle>School & address</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="School name"><Input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} /></Field>
          <Field label="Class"><Input value={form.schoolClass} onChange={(e) => set("schoolClass", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Pincode"><Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} /></Field>
          <Field label="Address" full>
            <textarea className={`${selectClass} min-h-20 py-2`} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Parents */}
      <Card>
        <CardHeader><CardTitle>Parent / guardian details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Father's name"><Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></Field>
          <Field label="Father's contact"><Input value={form.fatherContact} onChange={(e) => set("fatherContact", e.target.value)} placeholder="+9198…" /></Field>
          <Field label="Mother's name"><Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></Field>
          <Field label="Mother's contact"><Input value={form.motherContact} onChange={(e) => set("motherContact", e.target.value)} placeholder="+9198…" /></Field>
          <Field label="Parent email"><Input type="email" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></Field>
        </CardContent>
      </Card>

      {/* Sticky action bar — stays visible while scrolling the long form */}
      <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="submit">{existing ? "Update student" : "Add student"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
