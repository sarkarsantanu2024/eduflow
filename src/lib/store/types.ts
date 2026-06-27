/**
 * Plain shared types (no "use client") for every data entity. Both the client
 * store (local-db.ts) and the server-side data actions import from here.
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
  photo: string; // data URL or Blob URL
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
  kind: "monthly" | "other";
  period: string; // "YYYY-MM" for monthly fees; "" for other
  title: string;
  type: string;
  amount: number; // rupees
  amountPaid: number;
  status: "paid" | "partial" | "pending" | "overdue";
  dueDate: string;
  reminderSentAt: string;
  approved: boolean;
  voucherSentAt: string;
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
  category: string;
  amount: number; // rupees
  date: string; // YYYY-MM-DD
  note: string;
}

export const EXPENSE_CATEGORIES = ["Rent", "Salary", "Utilities", "Marketing", "Supplies", "Maintenance", "Other"] as const;

export interface Attendance {
  id: string;
  date: string;
  batchId: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  present: boolean;
}

export interface Promotion {
  id: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  fromLevel: string;
  toLevel: string;
  score: string;
  date: string;
  notified: boolean;
}

export interface TestScore {
  id: string;
  testName: string;
  date: string;
  batchId: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  score: number;
  maxScore: number;
}

export interface Certificate {
  id: string;
  serial: string;
  studentId: string;
  studentName: string;
  title: string;
  course: string;
  issueDate: string;
}

export interface ExamReg {
  id: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  board: string;
  tier: string;
  examDate: string;
  fee: number;
  status: "registered" | "admit_card" | "result_out";
}

export interface Performance {
  id: string;
  studentId: string;
  studentName: string;
  parentMobile: string;
  event: string;
  level: string;
  result: string;
  date: string;
}

export interface Material {
  id: string;
  studentId: string;
  studentName: string;
  item: string;
  amount: number;
  issued: boolean;
  date: string;
}

export interface InstituteEvent {
  id: string;
  title: string;
  date: string;
  venue: string;
  note: string;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  specialization: string;
  batchIds: string[];
  rating: number;
  joinDate: string;
  salary: number;
  note: string;
}

/** A student's effective monthly fee — their own override, else the center default. */
export function effectiveFee(student: { monthlyFee?: number }, centerFee: number): number {
  return student.monthlyFee && student.monthlyFee > 0 ? student.monthlyFee : centerFee;
}

/** Position of one text field on the certificate (x/y as % of image, size in px). */
export interface CertPos {
  x: number;
  y: number;
  size: number;
}

/** Layout for the customer's branded certificate template. */
export interface CertLayout {
  name: CertPos;
  course: CertPos;
  date: CertPos;
  serial: CertPos;
  qr: { x: number; y: number; size: number; show: boolean };
  color: string;
}

export const DEFAULT_CERT_LAYOUT: CertLayout = {
  name: { x: 50, y: 46, size: 40 },
  course: { x: 50, y: 60, size: 22 },
  date: { x: 28, y: 86, size: 16 },
  serial: { x: 72, y: 86, size: 14 },
  qr: { x: 88, y: 78, size: 90, show: true },
  color: "#1f2937",
};

export interface Profile {
  businessName: string;
  businessType: string;
  ownerName: string;
  email: string;
  phone: string;
  gst: string;
  city: string;
  address: string;
  monthlyFee: number;
  reactivationFee: number;
  website: string;
  upiId: string;
  qrImage: string; // data URL or Blob URL
  avatar: string;
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  certImage: string;
  certLayout: CertLayout;
}

export interface Db {
  students: Student[];
  courses: Course[];
  batches: Batch[];
  templates: Template[];
  fees: Fee[];
  payments: Payment[];
  expenses: Expense[];
  attendance: Attendance[];
  promotions: Promotion[];
  testScores: TestScore[];
  certificates: Certificate[];
  examRegs: ExamReg[];
  performances: Performance[];
  materials: Material[];
  events: InstituteEvent[];
  teachers: Teacher[];
  profile: Profile;
}

export type CollectionName =
  | "students" | "courses" | "batches" | "templates" | "fees" | "payments" | "expenses"
  | "attendance" | "promotions" | "testScores" | "certificates" | "examRegs"
  | "performances" | "materials" | "events" | "teachers";

export const EMPTY_PROFILE: Profile = {
  businessName: "", businessType: "abacus", ownerName: "", email: "", phone: "",
  gst: "", city: "", address: "", monthlyFee: 0, reactivationFee: 0, website: "", upiId: "", qrImage: "", avatar: "",
  facebook: "", instagram: "", youtube: "", whatsapp: "",
  certImage: "", certLayout: DEFAULT_CERT_LAYOUT,
};

export const EMPTY_DB: Db = {
  students: [], courses: [], batches: [], templates: [], fees: [], payments: [], expenses: [],
  attendance: [], promotions: [], testScores: [], certificates: [], examRegs: [],
  performances: [], materials: [], events: [], teachers: [],
  profile: EMPTY_PROFILE,
};
