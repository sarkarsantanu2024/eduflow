import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb,
  doublePrecision, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import type { CertLayout } from "../store/types";

/**
 * EduFlow database schema (Neon Postgres via Drizzle).
 *
 * Multi-tenant: every tenant-owned row carries `institute_id`. Tenant
 * isolation is enforced in the data-access layer (every query is scoped by
 * the signed-in user's institute), with a super_admin able to read across all.
 *
 * Money is stored in WHOLE RUPEES (integers) to match the UI model.
 */

// ── Enums ────────────────────────────────────────────────────────────
export const userRole = pgEnum("user_role", [
  "super_admin", "institute_admin", "teacher", "parent",
]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const studentStatus = pgEnum("student_status", [
  "active", "inactive", "graduated", "dropped",
]);
export const feeStatus = pgEnum("fee_status", [
  "paid", "partial", "pending", "overdue",
]);
export const paymentMethod = pgEnum("payment_method", [
  "upi", "cash", "bank", "razorpay",
]);
export const paymentStatus = pgEnum("payment_status", ["success", "pending"]);
// Superset of the sector `value`s in src/lib/sectors.ts. (Kept additive so
// schema pushes stay non-destructive; `music`/`computer_training` are unused.)
export const instituteType = pgEnum("institute_type", [
  "abacus", "coaching", "computer", "computer_training", "dance", "drawing",
  "music", "spoken_english", "tuition", "other",
]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing", "active", "past_due", "canceled", "expired",
]);
export const classPlatform = pgEnum("class_platform", [
  "zoom", "google_meet", "jitsi", "youtube", "other",
]);

// ── Shared columns ───────────────────────────────────────────────────
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ── Subscription plans (GLOBAL, not tenant-scoped) ───────────────────
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 'starter' | 'growth' | 'professional'
  name: text("name").notNull(),
  priceMonthly: integer("price_monthly").notNull(), // rupees
  maxStudents: integer("max_students"), // null = unlimited
  maxStaff: integer("max_staff"),
  whatsappQuota: integer("whatsapp_quota"),
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

// ── Institutes (TENANT ROOT) ─────────────────────────────────────────
// Combines the SQL `institutes` table with the rich per-center profile
// fields the UI keeps (branding, fees, UPI, socials, certificate template).
export const institutes = pgTable("institutes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: instituteType("type").notNull().default("abacus"),
  ownerName: text("owner_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  gst: text("gst"),
  city: text("city"),
  address: text("address"),
  website: text("website"),
  // Fees / payments
  monthlyFee: integer("monthly_fee").notNull().default(0), // flat center fee, rupees
  reactivationFee: integer("reactivation_fee").notNull().default(0),
  upiId: text("upi_id"),
  // Branding / media (Vercel Blob URLs)
  logoUrl: text("logo_url"),
  qrImageUrl: text("qr_image_url"),
  avatarUrl: text("avatar_url"),
  // Socials
  facebook: text("facebook"),
  instagram: text("instagram"),
  youtube: text("youtube"),
  // Certificate template
  certImageUrl: text("cert_image_url"),
  certLayout: jsonb("cert_layout").$type<CertLayout>(),
  isActive: boolean("is_active").notNull().default(true),
  // False until the owner completes their profile setup (drives onboarding gate).
  onboarded: boolean("onboarded").notNull().default(false),
  ...timestamps,
});

// ── Users (Auth.js identities + tenant binding + role) ───────────────
// A super_admin has institute_id = null and operates across tenants.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").references(() => institutes.id, { onDelete: "cascade" }),
  role: userRole("role").notNull().default("institute_admin"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null for Google-only (OAuth) accounts
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  byInstitute: index("users_institute_idx").on(t.instituteId),
}));

// ── Subscriptions (one active per institute) ─────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: subscriptionStatus("status").notNull().default("trialing"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  ...timestamps,
});

// ── Courses ──────────────────────────────────────────────────────────
export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("courses_institute_idx").on(t.instituteId) }));

// ── Teachers / staff ─────────────────────────────────────────────────
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  specialization: text("specialization").notNull().default(""),
  batchIds: jsonb("batch_ids").$type<string[]>().notNull().default([]),
  rating: integer("rating").notNull().default(0),
  joinDate: date("join_date"),
  salary: integer("salary").notNull().default(0),
  note: text("note").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("teachers_institute_idx").on(t.instituteId) }));

// ── Batches ──────────────────────────────────────────────────────────
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  timing: text("timing").notNull().default(""),
  days: text("days").notNull().default(""), // free text, e.g. "Mon, Wed, Fri"
  capacity: text("capacity").notNull().default(""), // free text to match the UI
  ...timestamps,
}, (t) => ({ byInstitute: index("batches_institute_idx").on(t.instituteId) }));

// ── Students ─────────────────────────────────────────────────────────
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  gender: genderEnum("gender"),
  dob: date("dob"),
  admissionDate: date("admission_date"),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
  monthlyFee: integer("monthly_fee").notNull().default(0), // per-student override; 0 = use center fee
  // Admission-form fields
  centreName: text("centre_name").notNull().default(""),
  hobbies: text("hobbies").notNull().default(""),
  siblingAge: text("sibling_age").notNull().default(""),
  schoolName: text("school_name").notNull().default(""),
  schoolClass: text("school_class").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  pincode: text("pincode").notNull().default(""),
  fatherName: text("father_name").notNull().default(""),
  fatherContact: text("father_contact").notNull().default(""),
  motherName: text("mother_name").notNull().default(""),
  motherContact: text("mother_contact").notNull().default(""),
  parentName: text("parent_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  parentEmail: text("parent_email").notNull().default(""),
  photoUrl: text("photo_url"), // Vercel Blob URL
  status: studentStatus("status").notNull().default("active"),
  ...timestamps,
}, (t) => ({
  byInstitute: index("students_institute_idx").on(t.instituteId),
  codeUnique: uniqueIndex("students_code_per_institute").on(t.instituteId, t.code),
}));

// ── Fees ─────────────────────────────────────────────────────────────
export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  kind: text("kind").notNull().default("monthly"), // 'monthly' | 'other'
  period: text("period").notNull().default(""), // "YYYY-MM" for monthly
  title: text("title").notNull(),
  type: text("type").notNull().default("monthly"),
  amount: integer("amount").notNull().default(0), // rupees
  amountPaid: integer("amount_paid").notNull().default(0),
  status: feeStatus("status").notNull().default("pending"),
  dueDate: date("due_date"),
  reminderSentAt: text("reminder_sent_at").notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  voucherSentAt: text("voucher_sent_at").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("fees_institute_idx").on(t.instituteId) }));

// ── Payments ─────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  studentName: text("student_name").notNull().default(""),
  amount: integer("amount").notNull().default(0), // rupees
  method: paymentMethod("method").notNull().default("upi"),
  status: paymentStatus("status").notNull().default("success"),
  date: date("date"),
  ...timestamps,
}, (t) => ({ byInstitute: index("payments_institute_idx").on(t.instituteId) }));

// ── Expenses ─────────────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Other"),
  amount: integer("amount").notNull().default(0), // rupees
  date: date("date"),
  note: text("note").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("expenses_institute_idx").on(t.instituteId) }));

// ── Message templates ────────────────────────────────────────────────
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"),
  channel: text("channel").notNull().default("whatsapp"),
  body: text("body").notNull(),
  ...timestamps,
}, (t) => ({ byInstitute: index("templates_institute_idx").on(t.instituteId) }));

// ── Attendance ───────────────────────────────────────────────────────
export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  present: boolean("present").notNull().default(true),
  ...timestamps,
}, (t) => ({ byInstitute: index("attendance_institute_idx").on(t.instituteId) }));

// ── Promotions (level/grade changes) ─────────────────────────────────
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  fromLevel: text("from_level").notNull().default(""),
  toLevel: text("to_level").notNull().default(""),
  score: text("score").notNull().default(""),
  date: date("date"),
  notified: boolean("notified").notNull().default(false),
  ...timestamps,
}, (t) => ({ byInstitute: index("promotions_institute_idx").on(t.instituteId) }));

// ── Test scores ──────────────────────────────────────────────────────
export const testScores = pgTable("test_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  testName: text("test_name").notNull(),
  date: date("date"),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  score: doublePrecision("score").notNull().default(0),
  maxScore: doublePrecision("max_score").notNull().default(100),
  ...timestamps,
}, (t) => ({ byInstitute: index("test_scores_institute_idx").on(t.instituteId) }));

// ── Certificates ─────────────────────────────────────────────────────
export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  serial: text("serial").notNull(), // verification id (printed + QR)
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  studentName: text("student_name").notNull().default(""),
  title: text("title").notNull(),
  course: text("course").notNull().default(""),
  issueDate: date("issue_date"),
  ...timestamps,
}, (t) => ({
  byInstitute: index("certificates_institute_idx").on(t.instituteId),
  serialUnique: uniqueIndex("certificates_serial_unique").on(t.serial),
}));

// ── Exam-board registrations ─────────────────────────────────────────
export const examRegs = pgTable("exam_regs", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  board: text("board").notNull().default(""),
  tier: text("tier").notNull().default(""),
  examDate: date("exam_date"),
  fee: integer("fee").notNull().default(0),
  status: text("status").notNull().default("registered"), // registered | admit_card | result_out
  ...timestamps,
}, (t) => ({ byInstitute: index("exam_regs_institute_idx").on(t.instituteId) }));

// ── Performances (competitions / recitals) ───────────────────────────
export const performances = pgTable("performances", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  parentMobile: text("parent_mobile").notNull().default(""),
  event: text("event").notNull().default(""),
  level: text("level").notNull().default(""),
  result: text("result").notNull().default(""),
  date: date("date"),
  ...timestamps,
}, (t) => ({ byInstitute: index("performances_institute_idx").on(t.instituteId) }));

// ── Materials / kits issued ──────────────────────────────────────────
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  item: text("item").notNull().default(""),
  amount: integer("amount").notNull().default(0),
  issued: boolean("issued").notNull().default(false),
  date: date("date"),
  ...timestamps,
}, (t) => ({ byInstitute: index("materials_institute_idx").on(t.instituteId) }));

// ── Events ───────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date"),
  venue: text("venue").notNull().default(""),
  note: text("note").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("events_institute_idx").on(t.instituteId) }));

// ── Online classes (Phase 3) ─────────────────────────────────────────
export const onlineClasses = pgTable("online_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  platform: classPlatform("platform").notNull().default("google_meet"),
  meetingUrl: text("meeting_url").notNull().default(""),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMins: integer("duration_mins").notNull().default(60),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (t) => ({ byInstitute: index("online_classes_institute_idx").on(t.instituteId) }));

// ── Video library (Phase 3) ──────────────────────────────────────────
export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  url: text("url").notNull().default(""), // YouTube/Vimeo link or Vercel Blob URL
  thumbnailUrl: text("thumbnail_url"),
  isPublished: boolean("is_published").notNull().default(true),
  ...timestamps,
}, (t) => ({ byInstitute: index("videos_institute_idx").on(t.instituteId) }));

// ── Activity log (audit trail; powers super-admin "recent activity") ──
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").references(() => institutes.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byInstitute: index("activity_logs_institute_idx").on(t.instituteId) }));
