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
  title: string;
  type: string;
  amount: number; // rupees
  amountPaid: number;
  status: "paid" | "partial" | "pending" | "overdue";
  dueDate: string;
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
  profile: Profile;
}

export type CollectionName = "students" | "courses" | "batches" | "templates" | "fees" | "payments";

const EMPTY_PROFILE: Profile = {
  businessName: "", businessType: "abacus", ownerName: "", email: "", phone: "",
  gst: "", city: "", address: "", monthlyFee: 0, website: "", upiId: "", qrImage: "", avatar: "",
  facebook: "", instagram: "", youtube: "", whatsapp: "",
};

const EMPTY: Db = {
  students: [], courses: [], batches: [], templates: [], fees: [], payments: [],
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
    id: `student_${n}`, code: `BM-${String(n).padStart(4, "0")}`, firstName: first, lastName: last,
    gender: n % 2 === 0 ? "female" : "male", dob: "2015-04-12", admissionDate: "2026-01-15",
    courseId: "course_1", batchId: "batch_1", centreName: "Dum Dum", hobbies: "", siblingAge: "",
    schoolName: "", schoolClass: "", address: "Kolkata", city: "Kolkata", pincode: "700030",
    fatherName: father, fatherContact: mobile, motherName: "", motherContact: "",
    parentName: father, parentMobile: mobile, parentEmail: "", photo: "", status,
  });

  const students: Student[] = [
    mkStudent(1, "Aarav", "Sharma", "Rohit Sharma", "+919811111111"),
    mkStudent(2, "Diya", "Gupta", "Anil Gupta", "+919822222222"),
    mkStudent(3, "Vivaan", "Singh", "Manoj Singh", "+919833333333"),
    mkStudent(4, "Ananya", "Roy", "Sourav Roy", "+919844444444"),
  ];

  const templates: Template[] = [
    { id: "tpl_1", name: "Fee Due Reminder", type: "fee_due", channel: "whatsapp", body: "Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}." },
    { id: "tpl_2", name: "Fee Overdue", type: "fee_overdue", channel: "whatsapp", body: "Reminder: ₹{{amount}} for {{student_name}} is overdue. Please pay soon." },
  ];

  const fees: Fee[] = [
    { id: "fee_1", studentId: "student_1", studentName: "Aarav Sharma", title: "June 2026 Monthly Fee", type: "monthly", amount: 500, amountPaid: 500, status: "paid", dueDate: "2026-06-05" },
    { id: "fee_2", studentId: "student_2", studentName: "Diya Gupta", title: "June 2026 Monthly Fee", type: "monthly", amount: 500, amountPaid: 0, status: "overdue", dueDate: "2026-06-05" },
  ];

  const payments: Payment[] = [
    { id: "pay_1", studentId: "student_1", studentName: "Aarav Sharma", amount: 500, method: "upi", status: "success", date: "2026-06-03" },
  ];

  return {
    courses, batches, students, templates, fees, payments,
    profile: { ...EMPTY_PROFILE, businessName: "Bright Minds Abacus Academy", city: "Kolkata", monthlyFee: 500, upiId: "santanusarkar69@ibl" },
  };
}
