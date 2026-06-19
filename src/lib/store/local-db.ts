"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Browser-persistent demo database (localStorage).
 * Every section reads/writes here so data survives refresh with no backend.
 * Starts EMPTY — use loadSamples() to populate, resetDb() to clear.
 *
 * When you connect Supabase later, swap these hooks for server queries.
 */

export type StudentStatus = "active" | "inactive" | "graduated" | "dropped";

export interface Student {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other" | "";
  dob: string;
  admissionDate: string;
  courseId: string;
  batchId: string;
  monthlyFee: number; // per-student fee; 0 = use the center's flat fee
  // admission-form fields (Mind Mantra style)
  centreName: string;
  hobbies: string;
  siblingAge: string;
  schoolName: string;
  schoolClass: string;
  address: string;
  city: string;
  pincode: string;
  fatherName: string;
  fatherContact: string;
  motherName: string;
  motherContact: string;
  parentName: string;
  parentMobile: string;
  parentEmail: string;
  photo: string; // data URL
  status: StudentStatus;
}

export interface Course {
  id: string;
  name: string;
  description: string;
}

export interface Batch {
  id: string;
  name: string;
  timing: string;
  days: string;
  capacity: string;
  courseId: string;
}

export interface Template {
  id: string;
  name: string;
  type: string;
  channel: string;
  body: string;
}

export interface Fee {
  id: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  kind: "monthly" | "other"; // monthly tuition vs one-off fee/expense
  period: string; // "YYYY-MM" for monthly fees; "" for other
  title: string;
  type: string;
  amount: number; // rupees
  amountPaid: number;
  status: "paid" | "partial" | "pending" | "overdue";
  dueDate: string;
  reminderSentAt: string; // last WhatsApp reminder/QR sent (ISO date) or ""
  approved: boolean; // admin approval before a voucher is issued (other fees)
  voucherSentAt: string; // voucher/receipt sent on WhatsApp (ISO date) or ""
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number; // rupees
  method: "upi" | "cash" | "bank";
  status: "success" | "pending";
  date: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string; // Rent, Salary, Utilities, Marketing, Supplies, Other
  amount: number; // rupees
  date: string; // YYYY-MM-DD
  note: string;
}

export const EXPENSE_CATEGORIES = ["Rent", "Salary", "Utilities", "Marketing", "Supplies", "Maintenance", "Other"] as const;

/** A student's effective monthly fee — their own override, else the center default. */
export function effectiveFee(student: { monthlyFee?: number }, centerFee: number): number {
  return student.monthlyFee && student.monthlyFee > 0 ? student.monthlyFee : centerFee;
}

export interface Profile {
  businessName: string;
  businessType: string;
  ownerName: string;
  email: string;
  phone: string;
  gst: string;
  city: string;
  address: string;
  monthlyFee: number; // flat monthly fee for this center (rupees)
  reactivationFee: number; // fee to resume a paused student (rupees)
  website: string;
  upiId: string;
  qrImage: string; // data URL
  avatar: string; // data URL
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
}

export interface Db {
  students: Student[];
  courses: Course[];
  batches: Batch[];
  templates: Template[];
  fees: Fee[];
  payments: Payment[];
  expenses: Expense[];
  profile: Profile;
}

export type CollectionName = "students" | "courses" | "batches" | "templates" | "fees" | "payments" | "expenses";

const EMPTY_PROFILE: Profile = {
  businessName: "", businessType: "abacus", ownerName: "", email: "", phone: "",
  gst: "", city: "", address: "", monthlyFee: 0, reactivationFee: 0, website: "", upiId: "", qrImage: "", avatar: "",
  facebook: "", instagram: "", youtube: "", whatsapp: "",
};

const EMPTY: Db = {
  students: [], courses: [], batches: [], templates: [], fees: [], payments: [], expenses: [],
  profile: EMPTY_PROFILE,
};

const KEY = "eduflow_db_v1";
const listeners = new Set<() => void>();
let mem: Db | null = null;

function read(): Db {
  if (typeof window === "undefined") return EMPTY;
  if (mem) return mem;
  let loaded: Db = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Db>;
      loaded = { ...EMPTY, ...parsed, profile: { ...EMPTY_PROFILE, ...parsed.profile } };
      // Back-fill fees saved before the monthly/other fields existed.
      loaded.fees = loaded.fees.map((f) => ({
        ...f,
        parentMobile: f.parentMobile ?? "",
        kind: f.kind ?? (f.type === "monthly" ? "monthly" : "other"),
        period: f.period ?? "",
        reminderSentAt: f.reminderSentAt ?? "",
        approved: f.approved ?? false,
        voucherSentAt: f.voucherSentAt ?? "",
      }));

      // Retention: keep ~1 year of financial records to reduce storage cost.
      // Open dues are kept regardless (you don't lose money owed). In production
      // this is a Supabase TTL / scheduled archival job, not client-side.
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      const cutoff = cutoffDate.toISOString().slice(0, 10);
      loaded.fees = loaded.fees.filter((f) => f.status !== "paid" || (f.dueDate || `${f.period}-01`) >= cutoff);
      loaded.payments = loaded.payments.filter((p) => p.date >= cutoff);
      loaded.expenses = loaded.expenses.filter((e) => e.date >= cutoff);
      // Archive only graduated/dropped students older than a year (active stay).
      loaded.students = loaded.students.filter(
        (s) => !((s.status === "graduated" || s.status === "dropped") && (s.admissionDate || "9999") < cutoff),
      );
    }
  } catch {
    loaded = EMPTY;
  }
  mem = loaded;
  return loaded;
}

function write(next: Db) {
  mem = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/** Stable, collision-resistant id without Math.random in render. */
let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

// ── public mutations ────────────────────────────────────────────────
export function addItem<T extends { id: string }>(name: CollectionName, item: T) {
  const db = read();
  write({ ...db, [name]: [item, ...(db[name] as unknown as T[])] });
}

export function updateItem<T extends { id: string }>(name: CollectionName, id: string, patch: Partial<T>) {
  const db = read();
  write({ ...db, [name]: (db[name] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
}

export function removeItem(name: CollectionName, id: string) {
  const db = read();
  write({ ...db, [name]: (db[name] as { id: string }[]).filter((x) => x.id !== id) });
}

export function setProfile(patch: Partial<Profile>) {
  const db = read();
  write({ ...db, profile: { ...db.profile, ...patch } });
}

export function resetDb() {
  write({ ...EMPTY, profile: EMPTY_PROFILE });
}

export function loadSamples() {
  write(buildSamples());
}

// ── hooks ───────────────────────────────────────────────────────────
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useCollection<K extends CollectionName>(name: K): Db[K] {
  const db = useDb();
  return db[name];
}

export function useProfile(): Profile {
  return useDb().profile;
}

/** True once the client has mounted (avoids SSR/localStorage flash). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// ── sample data ─────────────────────────────────────────────────────
function buildSamples(): Db {
  const levels: [string, string][] = [
    ["Basic", "Single digit add/subtract chains"],
    ["Kids 1", "Small numbers, short chains"],
    ["Kids 2", "Bigger numbers, longer chains"],
    ["Kids 3", "Two-digit chains with carry"],
    ["Level 1", "Small Friend concept"],
    ["Level 2", "Big Friend concept"],
    ["Level 3", "Mix Friend"],
    ["Level 4", "Two-digit advanced"],
    ["Level 5", "Three-digit operations"],
    ["Level 6", "Multiplication basics"],
    ["Level 7", "Division basics"],
    ["Level 8", "Advanced all operations"],
  ];
  const courses: Course[] = levels.map(([name, description], i) => ({
    id: `course_${i + 1}`, name, description,
  }));

  const batches: Batch[] = [
    { id: "batch_1", name: "Evening Batch A", timing: "5:00 PM - 6:30 PM", days: "Mon, Wed, Fri", capacity: "20", courseId: "course_1" },
    { id: "batch_2", name: "Morning Batch B", timing: "7:00 AM - 8:30 AM", days: "Tue, Thu, Sat", capacity: "15", courseId: "course_5" },
  ];

  const mkStudent = (n: number, first: string, last: string, father: string, mobile: string, status: StudentStatus = "active"): Student => ({
    id: `student_${n}`, code: `MMA-${String(n).padStart(4, "0")}`, firstName: first, lastName: last,
    gender: n % 2 === 0 ? "female" : "male", dob: "2015-04-12", admissionDate: "2026-01-15",
    courseId: "course_1", batchId: "batch_1", monthlyFee: 0, centreName: "Dum Dum", hobbies: "", siblingAge: "",
    schoolName: "", schoolClass: "", address: "Kolkata", city: "Kolkata", pincode: "700030",
    fatherName: father, fatherContact: mobile, motherName: "", motherContact: "",
    parentName: father, parentMobile: mobile, parentEmail: "", photo: "", status,
  });

  const MOBILE = "9804243159"; // demo: every WhatsApp message goes to this one number
  const students: Student[] = [
    mkStudent(1, "Aarav", "Sharma", "Rohit Sharma", MOBILE),
    mkStudent(2, "Diya", "Gupta", "Anil Gupta", MOBILE),
    mkStudent(3, "Vivaan", "Singh", "Manoj Singh", MOBILE),
    mkStudent(4, "Ananya", "Roy", "Sourav Roy", MOBILE),
    mkStudent(5, "Kabir", "Khan", "Imran Khan", MOBILE),
  ];
  students[0]!.dob = "2016-06-16"; // birthday "today" — for the WhatsApp birthday demo
  // Spread admission dates across the last 6 months (real enrolment chart).
  students[1]!.admissionDate = "2026-02-10";
  students[2]!.admissionDate = "2026-03-05";
  students[3]!.admissionDate = "2026-05-20";
  students[3]!.monthlyFee = 400; // Ananya pays a custom ₹400 (per-student fee card demo)
  students[4]!.admissionDate = "2026-04-08";
  students[4]!.status = "dropped"; // a dropout, for status/retention metrics

  const templates: Template[] = [
    { id: "tpl_1", name: "Fee Due Reminder", type: "fee_due", channel: "whatsapp", body: "Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. Scan the QR to pay. — MMA-Barasat" },
    { id: "tpl_2", name: "Fee Overdue", type: "fee_overdue", channel: "whatsapp", body: "Reminder: ₹{{amount}} for {{student_name}} is overdue. Please pay soon. — MMA-Barasat" },
    { id: "tpl_3", name: "Birthday Wish", type: "birthday", channel: "whatsapp", body: "Happy Birthday {{student_name}}! 🎉 Wishing you a wonderful year ahead. — MMA-Barasat" },
    { id: "tpl_4", name: "Holiday Notice", type: "holiday_notice", channel: "whatsapp", body: "Dear parents, the center will remain closed on {{date}} for {{occasion}}. — MMA-Barasat" },
    { id: "tpl_5", name: "Class Closed Today", type: "closed_today", channel: "whatsapp", body: "Dear parents, today's class is cancelled ({{reason}}). Regular classes resume tomorrow. — MMA-Barasat" },
  ];

  const mFee = (sid: string, sname: string, period: string, label: string, paid: boolean, due: string, status: Fee["status"]): Fee => ({
    id: `monthly_${sid}_${period}`, studentId: sid, studentName: sname, parentMobile: MOBILE,
    kind: "monthly", period, title: `${label} Monthly Fee`, type: "monthly",
    amount: 500, amountPaid: paid ? 500 : 0, status, dueDate: due,
    reminderSentAt: "", approved: false, voucherSentAt: "",
  });

  const fees: Fee[] = [
    // Aarav — fully paid, no arrears
    mFee("student_1", "Aarav Sharma", "2026-05", "May 2026", true, "2026-05-05", "paid"),
    mFee("student_1", "Aarav Sharma", "2026-06", "June 2026", true, "2026-06-05", "paid"),
    // Diya — 4 months pending → auto-deactivates (needs ₹700 to resume)
    mFee("student_2", "Diya Gupta", "2026-03", "March 2026", false, "2026-03-05", "overdue"),
    mFee("student_2", "Diya Gupta", "2026-04", "April 2026", false, "2026-04-05", "overdue"),
    mFee("student_2", "Diya Gupta", "2026-05", "May 2026", false, "2026-05-05", "overdue"),
    mFee("student_2", "Diya Gupta", "2026-06", "June 2026", false, "2026-06-05", "overdue"),
    // Vivaan — May paid, June pending (₹500)
    mFee("student_3", "Vivaan Singh", "2026-05", "May 2026", true, "2026-05-05", "paid"),
    mFee("student_3", "Vivaan Singh", "2026-06", "June 2026", false, "2026-06-05", "overdue"),
    // Ananya — joined this month, June due soon (custom ₹400 fee)
    { id: "monthly_student_4_2026-06", studentId: "student_4", studentName: "Ananya Roy", parentMobile: MOBILE, kind: "monthly", period: "2026-06", title: "June 2026 Monthly Fee", type: "monthly", amount: 400, amountPaid: 0, status: "pending", dueDate: "2026-06-25", reminderSentAt: "", approved: false, voucherSentAt: "" },
    // Kabir — June pending
    mFee("student_5", "Kabir Khan", "2026-06", "June 2026", false, "2026-06-05", "overdue"),
    // One-off expense (other fee) — QR already sent, awaiting payment
    {
      id: "fee_book_1", studentId: "student_3", studentName: "Vivaan Singh", parentMobile: MOBILE,
      kind: "other", period: "", title: "Level 2 Workbook", type: "material", amount: 300, amountPaid: 0,
      status: "pending", dueDate: "2026-06-20", reminderSentAt: "2026-06-12", approved: false, voucherSentAt: "",
    },
  ];

  const payments: Payment[] = [
    { id: "pay_1", studentId: "student_1", studentName: "Aarav Sharma", amount: 500, method: "upi", status: "success", date: "2026-05-04" },
    { id: "pay_2", studentId: "student_1", studentName: "Aarav Sharma", amount: 500, method: "upi", status: "success", date: "2026-06-03" },
    { id: "pay_3", studentId: "student_3", studentName: "Vivaan Singh", amount: 500, method: "cash", status: "success", date: "2026-05-06" },
  ];

  const expenses: Expense[] = [
    { id: "exp_1", title: "Center rent", category: "Rent", amount: 12000, date: "2026-06-01", note: "Monthly rent" },
    { id: "exp_2", title: "Teacher salary", category: "Salary", amount: 18000, date: "2026-06-01", note: "2 teachers" },
    { id: "exp_3", title: "Electricity bill", category: "Utilities", amount: 1800, date: "2026-06-08", note: "" },
    { id: "exp_4", title: "Facebook ads", category: "Marketing", amount: 2500, date: "2026-06-10", note: "Admission campaign" },
    { id: "exp_5", title: "Abacus kits", category: "Supplies", amount: 3200, date: "2026-06-12", note: "20 kits" },
    { id: "exp_6", title: "Center rent", category: "Rent", amount: 12000, date: "2026-05-01", note: "Monthly rent" },
    { id: "exp_7", title: "Teacher salary", category: "Salary", amount: 18000, date: "2026-05-01", note: "2 teachers" },
    { id: "exp_8", title: "Printing & stationery", category: "Supplies", amount: 1200, date: "2026-05-15", note: "" },
  ];

  return {
    courses, batches, students, templates, fees, payments, expenses,
    profile: {
      ...EMPTY_PROFILE, businessName: "MMA-Barasat", ownerName: "Santanu Sarkar",
      phone: MOBILE, whatsapp: MOBILE, city: "Kolkata", address: "Barasat, Kolkata",
      monthlyFee: 500, reactivationFee: 700, upiId: "santanusarkar69@ibl",
    },
  };
}
