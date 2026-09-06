"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
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
import { nextStudentCode } from "@/features/students/student-code";
import { defaultBillingStart } from "@/features/students/billing-start";
import { getLabels } from "@/lib/constants";
import { todayIso } from "@/lib/date";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

const blank: Omit<Student, "id"> = {
  code: "", firstName: "", lastName: "", gender: "", dob: "", admissionDate: "",
  courseId: "", batchId: "", monthlyFee: 0, billingStartMonth: "", centreName: "", hobbies: "", siblingAge: "",
  schoolName: "", schoolClass: "", address: "", city: "", pincode: "",
  fatherName: "", fatherContact: "", motherName: "", motherContact: "",
  parentName: "", parentMobile: "", parentEmail: "", photo: "", status: "active",
};

/**
 * Fields an admission cannot be saved without. Centre name is absent because
 * it is filled from the profile and shown read-only, and Status/Gender already
 * default to a valid value.
 */
const REQUIRED_FIELDS: Array<[keyof Omit<Student, "id">, string]> = [
  ["code", "Student ID"],
  ["firstName", "First name"],
  ["dob", "Date of birth"],
  ["admissionDate", "Admission date"],
  ["courseId", "Course/Level"],
  ["batchId", "Batch"],
  ["schoolName", "School name"],
  ["pincode", "Pincode"],
  ["address", "Address"],
  // Parent / guardian details are validated as a PAIR instead — see submit().
  // Requiring all four blocked single-parent and guardian-raised admissions,
  // and staff would have worked around it by typing something fake.
];

export function StudentStoreForm({ studentId }: { studentId?: string }) {
  const router = useRouter();
  const students = useCollection("students");
  const courses = useCollection("courses");
  const batches = useCollection("batches");
  const profile = useProfile();
  const { member } = getLabels(profile.businessType);
  const profileMonthlyFee = profile.monthlyFee || 0;
  const profileAdmissionFee = profile.admissionFee || 0;
  const today = todayIso();
  const ym = today.slice(0, 7);
  const monthLabel = new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });
  // Both of these are `null` until the owner overrides them, so they keep
  // following the admission date as it is typed.
  const [advanceMonth, setAdvanceMonth] = useState<boolean | null>(null);
  const [billingStart, setBillingStart] = useState<string | null>(null);

  const existing = studentId ? students.find((s) => s.id === studentId) : undefined;
  const [form, setForm] = useState<Omit<Student, "id">>(
    existing ? { ...existing } : { ...blank, admissionDate: today, monthlyFee: profileMonthlyFee },
  );
  // The ID is generated from centre, branch and admission month. An owner can
  // still take it over — some centres carry a numbering scheme from paper —
  // but they have to ask for it, so the default stays consistent.
  const [codeManual, setCodeManual] = useState(false);
  // One-time admission fee raised at admission. Blank = use the centre default;
  // editable so an owner can waive it (0) or adjust for a specific admission.
  const [admissionFee, setAdmissionFee] = useState<number | "">("");

  /**
   * An admission dated before this month means the owner is entering someone
   * who has been attending for a while — the usual first-week-of-use task, not
   * a walk-in. Those students were settled up on paper, so by default:
   * no admission fee, no advance month, and billing starts NEXT month.
   * Every one of these is still overridable right in the form.
   */
  const admissionYm = form.admissionDate.slice(0, 7);
  const isBackdated = Boolean(admissionYm) && admissionYm < ym;
  const firstBilledMonth =
    billingStart ?? (form.billingStartMonth || defaultBillingStart(form.admissionDate, ym));
  const collectAdvance = (advanceMonth ?? !isBackdated) && firstBilledMonth === ym;
  const admissionFeeDefault = isBackdated ? 0 : profileAdmissionFee;
  const firstBilledLabel = new Date(`${firstBilledMonth}-01T00:00:00Z`)
    .toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Generated from the centre and branch, as a running serial. Never touches an
  // existing student (their ID is printed on a card and quoted on receipts) or
  // one the owner has typed themselves.
  const autoCode = useMemo(
    () => nextStudentCode(profile.businessName, profile.city, students.map((s) => s.code)),
    [profile.businessName, profile.city, students],
  );
  useEffect(() => {
    if (existing || codeManual) return;
    setForm((f) => (f.code === autoCode ? f : { ...f, code: autoCode }));
  }, [autoCode, existing, codeManual]);

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
    // Everything an admission record needs to be useful later: the ID card, the
    // fee reminder, the certificate and the parent contact all depend on these.
    // Named individually so the owner is told exactly what is missing rather
    // than hunting a long form for a red box.
    const missing = REQUIRED_FIELDS.filter(([key]) => !String(form[key] ?? "").trim()).map(([, label]) => label);
    if (missing.length) {
      toast.error(`${missing.length} required field${missing.length > 1 ? "s" : ""} still empty`, {
        description: missing.join(", "),
        duration: 10000,
      });
      return;
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      toast.error("Pincode must be 6 digits");
      return;
    }
    // At least ONE guardian, complete. Every fee reminder, absence message and
    // result card goes to this number, so a name without a number is no use.
    const father = { name: form.fatherName.trim(), phone: form.fatherContact.trim() };
    const mother = { name: form.motherName.trim(), phone: form.motherContact.trim() };
    const complete = [father, mother].filter((g) => g.name && g.phone);
    if (complete.length === 0) {
      const partial = [father, mother].find((g) => g.name || g.phone);
      toast.error("One parent / guardian is required", {
        description: partial
          ? "Add both the name and the contact number for the same parent — messages need somewhere to go."
          : "Fill in either the father's name and contact, or the mother's name and contact.",
        duration: 10000,
      });
      return;
    }
    const badPhone = complete.find((g) => g.phone.replace(/\D/g, "").length < 10);
    if (badPhone) {
      toast.error("That contact number looks incomplete", {
        description: `"${badPhone.phone}" is not a 10-digit mobile number. WhatsApp reminders would never arrive.`,
        duration: 10000,
      });
      return;
    }
    if (!form.photo) {
      toast.error("Student photo is required", { description: "Tap the camera icon at the top of the form to upload one — it's used on the ID card." });
      return;
    }
    // Student ID is unique per centre in the database. Catch a clash here, or
    // the insert is rejected server-side and the optimistic row just vanishes.
    const code = form.code.trim();
    const clash = students.find((s) => s.id !== existing?.id && s.code.trim() === code);
    if (clash) {
      toast.error("That Student ID is already taken", {
        description: `${`${clash.firstName} ${clash.lastName}`.trim() || "Another record"} already uses ${code}. Give this ${member.toLowerCase()} a different ID.`,
        duration: 10000,
      });
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
      code,
      // Persisted so the nightly billing run applies the same rule. Blank for a
      // normal admission, which means "bill from the admission month".
      billingStartMonth: firstBilledMonth === (form.admissionDate.slice(0, 7) || ym) ? "" : firstBilledMonth,
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
      const admFee = admissionFee === "" ? admissionFeeDefault : admissionFee;
      const firstMonth = collectAdvance ? effectiveFee(payload, profile.monthlyFee || 0) : 0;
      if (admFee > 0) {
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: sid, studentName: name,
          parentMobile: payload.parentMobile, kind: "other", period: "",
          title: "Admission Fee", type: "admission", amount: admFee, amountPaid: 0,
          // Never dated in the past. Using the admission date made a student
          // entered today, admitted in January, look eight months overdue the
          // moment they were saved. A future admission still bills on the day.
          status: "pending", dueDate: payload.admissionDate > today ? payload.admissionDate : today,
          reminderSentAt: "", approved: false, voucherSentAt: "",
        });
      }
      if (firstMonth > 0) {
        const due = `${ym}-05`;
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: sid, studentName: name,
          parentMobile: payload.parentMobile, kind: "monthly", period: ym,
          title: `${monthLabel} Monthly Fee`, type: "monthly", amount: firstMonth, amountPaid: 0,
          // The 5th has already passed for anyone admitted later in the month,
          // so a fee raised today would arrive already overdue.
          status: "pending", dueDate: due > today ? due : today,
          reminderSentAt: "", approved: false, voucherSentAt: "",
        });
      }
      const total = admFee + firstMonth;
      const parts = [
        admFee > 0 ? `admission ₹${admFee}` : null,
        firstMonth > 0 ? `first month ₹${firstMonth}` : null,
      ].filter(Boolean);
      toast.success("Student added", {
        description: total > 0
          ? `Raised ₹${total} to collect — ${parts.join(" + ")}. Monthly billing runs from ${firstBilledLabel}.`
          : `Nothing to collect now. Monthly billing starts ${firstBilledLabel}.`,
      });
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
            <Field label="Student ID *">
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  readOnly={!codeManual && !existing}
                  className={!codeManual && !existing ? "cursor-not-allowed bg-muted/50" : undefined}
                  title={!codeManual && !existing ? "Generated from your centre, branch and the admission month" : undefined}
                />
                {!existing && (
                  <Button type="button" variant="outline" className="shrink-0"
                    onClick={() => { if (codeManual) { setCodeManual(false); set("code", autoCode); } else setCodeManual(true); }}>
                    {codeManual ? "Auto" : "Edit"}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {existing ? "Existing IDs are not renumbered — it is printed on the ID card."
                  : codeManual ? "Typing your own. Tap Auto to go back to the generated ID."
                  : "Generated from your centre name and branch."}
              </p>
            </Field>
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
            <Field label="Date of birth *"><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
            <Field label="Admission date *"><Input type="date" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} /></Field>
            <Field label="Centre name *">
              <Input value={profile.businessName} readOnly className="cursor-not-allowed bg-muted/50" title="Your centre — change it in Profile" />
            </Field>
            <Field label="Course/Level *">
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
            <Field label="Batch *">
              <select className={selectClass} value={form.batchId} onChange={(e) => set("batchId", e.target.value)}>
                <option value="">Select batch…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Monthly fee (₹)">
              <Input type="number" value={form.monthlyFee || ""} onChange={(e) => set("monthlyFee", Number(e.target.value) || 0)}
                placeholder={`Centre default (${profileMonthlyFee})`} />
              <p className="mt-1 text-xs text-muted-foreground">
                {profileMonthlyFee > 0
                  ? <>Filled from your centre fee (₹{profileMonthlyFee}). Change it here for this {member.toLowerCase()} only.</>
                  : <>No centre fee set yet — add one in <a href="/profile" className="font-medium text-primary underline">Profile</a>.</>}
              </p>
            </Field>
            {!existing && (
              <Field label="Admission fee (₹)">
                <Input type="number" value={admissionFee}
                  onChange={(e) => setAdmissionFee(e.target.value === "" ? "" : Number(e.target.value) || 0)}
                  placeholder={admissionFeeDefault > 0 ? `Centre default (${admissionFeeDefault})` : "No admission fee"} />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={collectAdvance} disabled={firstBilledMonth !== ym}
                    onChange={(e) => setAdvanceMonth(e.target.checked)} className="size-3.5" />
                  Collect {monthLabel} in advance
                </label>
                <p className="mt-1 text-xs text-muted-foreground">Charged once now. Blank = centre default; 0 = waive.</p>
              </Field>
            )}
            {(
              <Field label="Monthly billing starts">
                <Input type="month" value={firstBilledMonth} onChange={(e) => setBillingStart(e.target.value)} />
                {existing ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Months before this are never invoiced. Set it forward if this {member.toLowerCase()} was
                    already settled up on paper — it does not remove fees already raised, which you can clear
                    from the Fees page.
                  </p>
                ) : isBackdated ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Admitted <strong>{admissionYm}</strong>, before this month — so this looks like a
                    {" "}{member.toLowerCase()} you already had. Nothing is charged for the months before you
                    started using EduFlow, and the admission fee defaults to zero on the assumption it was
                    collected back then. Change either if that is not right.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    First month this {member.toLowerCase()} is invoiced for. Push it forward for a batch that
                    starts later.
                  </p>
                )}
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
          <Field label="School name *"><Input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} /></Field>
          <Field label="Class"><Input value={form.schoolClass} onChange={(e) => set("schoolClass", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Pincode *"><Input value={form.pincode} inputMode="numeric" maxLength={6}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="700124" /></Field>
          <Field label="Address *" full>
            <textarea className={`${selectClass} min-h-20 py-2`} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Parents */}
      <Card>
        <CardHeader>
          <CardTitle>Parent / guardian details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fill in <span className="font-medium text-foreground">at least one</span> — name and contact together.
            Either parent is fine; that number receives the fee reminders.
          </p>
        </CardHeader>
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
