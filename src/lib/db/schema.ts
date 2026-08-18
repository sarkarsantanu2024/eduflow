import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb,
  doublePrecision, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import type { AutomationSettings, CertLayout, IdCardDesign, RecurringCharge } from "../store/types";

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
  // NOTE: "org_admin" is appended last on purpose — Postgres `ALTER TYPE ... ADD
  // VALUE` appends, so the enum order here matches the additive migration.
  "super_admin", "institute_admin", "teacher", "parent", "org_admin",
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
  "music", "spoken_english", "tuition", "activity", "other",
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

// Soft-delete marker: null = live, timestamp = in Trash (recoverable). Rows stay
// in Trash until the owner restores or permanently deletes them — no auto-expiry.
const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

// ── Subscription plans (GLOBAL, not tenant-scoped) ───────────────────
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 'starter' | 'growth' | 'professional'
  name: text("name").notNull(),
  priceMonthly: integer("price_monthly").notNull(), // rupees
  priceAnnual: integer("price_annual").notNull().default(0), // rupees, 0 = not sold yearly
  maxStudents: integer("max_students"), // null = unlimited
  maxStaff: integer("max_staff"),
  whatsappQuota: integer("whatsapp_quota"),
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

// ── Organizations (HEAD-OFFICE / franchise group) ────────────────────
// A brand that owns several branches. A standalone center has no organization
// (organization_id = null). An org_admin (franchise owner) is bound to one of
// these instead of to a single institute. `partnerSharePercent` is the channel
// commission the org owner earns on each of its branches' subscriptions.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerName: text("owner_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  logoUrl: text("logo_url"),
  // Partner rebate: % of each branch's subscription the org owner earns (0–100).
  partnerSharePercent: integer("partner_share_percent").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

// ── Institutes (TENANT ROOT) ─────────────────────────────────────────
// Combines the SQL `institutes` table with the rich per-center profile
// fields the UI keeps (branding, fees, UPI, socials, certificate template).
export const institutes = pgTable("institutes", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Null = standalone center. Set = this center is a branch of an organization.
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
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
  admissionFee: integer("admission_fee").notNull().default(0), // one-time, new admissions
  reactivationFee: integer("reactivation_fee").notNull().default(0),
  // Legacy franchise royalty fields — migrated into recurringCharges.
  hoRoyaltyPerStudent: integer("ho_royalty_per_student").notNull().default(0),
  hoRoyaltyPercent: integer("ho_royalty_percent").notNull().default(0),
  // Recurring monthly costs (royalty, space rent, fixed subscriptions…) that
  // auto-post as expenses. See RecurringCharge.
  recurringCharges: jsonb("recurring_charges").$type<RecurringCharge[]>().notNull().default([]),
  upiId: text("upi_id"),
  // Branding / media (Vercel Blob URLs)
  logoUrl: text("logo_url"),
  qrImageUrl: text("qr_image_url"),
  avatarUrl: text("avatar_url"),
  // Socials
  facebook: text("facebook"),
  instagram: text("instagram"),
  youtube: text("youtube"),
  extraLink: text("extra_link"), // one more link (booking / review / landing page)
  // Certificate template
  certImageUrl: text("cert_image_url"),
  certLayout: jsonb("cert_layout").$type<CertLayout>(),
  idCardDesign: jsonb("id_card_design").$type<IdCardDesign>(),
  // WhatsApp automation switches (null = all off). One small jsonb column
  // instead of a settings table — keeps storage lean.
  automation: jsonb("automation").$type<AutomationSettings>(),
  isActive: boolean("is_active").notNull().default(true),
  // False until the owner completes their profile setup (drives onboarding gate).
  onboarded: boolean("onboarded").notNull().default(false),
  ...timestamps,
}, (t) => ({
  byOrganization: index("institutes_organization_idx").on(t.organizationId),
}));

// ── Users (Auth.js identities + tenant binding + role) ───────────────
// A super_admin has institute_id = null and operates across tenants.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").references(() => institutes.id, { onDelete: "cascade" }),
  // Set for an org_admin (franchise owner) — they operate over an organization,
  // not a single institute (institute_id stays null for them).
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  role: userRole("role").notNull().default("institute_admin"),
  // Login identity — what the user types on the sign-in screen.
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(), // contact email (no longer the login)
  passwordHash: text("password_hash"), // null for Google-only (OAuth) accounts
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  byInstitute: index("users_institute_idx").on(t.instituteId),
  byOrganization: index("users_organization_idx").on(t.organizationId),
}));

// ── Subscriptions (one active per institute) ─────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: subscriptionStatus("status").notNull().default("trialing"),
  // 'monthly' | 'annual' — annual is billed at 10 months for 12.
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  // Extra student slots PAID FOR on top of the plan cap, at ADD_ONS.extraStudent
  // per slot per month. Capacity is prepaid: a center cannot add a student
  // beyond (plan cap + these) until the slots have been paid for and a
  // super-admin has recorded them here. See src/lib/plan-limits.ts.
  extraStudents: integer("extra_students").notNull().default(0),
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
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
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
  // New-admission handover checklist (bag, t-shirt, id card, fees card, …).
  welcomeKit: jsonb("welcome_kit").$type<Record<string, boolean>>(),
  ...softDelete,
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
  ...softDelete,
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
  // What this collection was for, so a reversal knows what to roll back:
  // fee → restore the fee's dues, material → un-collect the kit, reactivation → just delete.
  source: text("source").notNull().default("fee"),
  date: date("date"),
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
  ...timestamps,
}, (t) => ({ byInstitute: index("templates_institute_idx").on(t.instituteId) }));

// ── WhatsApp automation outbox ───────────────────────────────────────
// Auto-queued reminders (fee due/overdue, absent, birthday) waiting for the
// owner's one-tap send. Storage-lean by design: the unique dedupe key means a
// reminder is queued at most ONCE ever, dismissed rows are deleted immediately,
// and sent rows are purged by the daily cron after 60 days.
export const messageOutbox = pgTable("message_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull().default(""),
  phone: text("phone").notNull(),
  kind: text("kind").notNull(), // 'fee_due' | 'fee_overdue' | 'absent' | 'birthday'
  body: text("body").notNull(), // final rendered message
  status: text("status").notNull().default("queued"), // 'queued' | 'sent'
  // e.g. "fee_due:<feeId>", "absent:<studentId>:<date>", "birthday:<studentId>:<year>"
  dedupeKey: text("dedupe_key").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byInstitute: index("message_outbox_institute_idx").on(t.instituteId),
  dedupe: uniqueIndex("message_outbox_dedupe").on(t.instituteId, t.dedupeKey),
}));

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
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
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
  ...softDelete,
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
  issued: boolean("issued").notNull().default(false), // reused as "charge paid"
  date: date("date"),
  ...softDelete,
  ...timestamps,
}, (t) => ({ byInstitute: index("materials_institute_idx").on(t.instituteId) }));

// ── Ad materials log (marketing collateral counts per entry) ─────────
export const adMaterials = pgTable("ad_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  date: date("date"),
  banner: integer("banner").notNull().default(0),
  leaflet: integer("leaflet").notNull().default(0),
  sunPack: integer("sun_pack").notNull().default(0),
  poster: integer("poster").notNull().default(0),
  voice: integer("voice").notNull().default(0),
  other: text("other").notNull().default(""),
  addedBy: text("added_by").notNull().default(""),
  ...softDelete,
  ...timestamps,
}, (t) => ({ byInstitute: index("ad_materials_institute_idx").on(t.instituteId) }));

// ── Stationery log (stationery / gifts per entry) ────────────────────
export const stationery = pgTable("stationery", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  date: date("date"),
  stationery: integer("stationery").notNull().default(0),
  gift: integer("gift").notNull().default(0),
  other: text("other").notNull().default(""),
  addedBy: text("added_by").notNull().default(""),
  ...softDelete,
  ...timestamps,
}, (t) => ({ byInstitute: index("stationery_institute_idx").on(t.instituteId) }));

// ── Events ───────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date"),
  venue: text("venue").notNull().default(""),
  note: text("note").notNull().default(""),
  ...softDelete,
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

// ── Leads (GLOBAL, not tenant-scoped) ────────────────────────────────
// Enquiries captured by the public marketing site's "Book your free demo"
// form (POST /api/leads). Visible to the super-admin only — this is the sales
// pipeline, not customer data.
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  centerName: text("center_name").notNull().default(""),
  centerType: text("center_type").notNull().default(""),
  students: integer("students"),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city"),
  message: text("message").notNull().default(""),
  /** Where it came from: website, facebook, linkedin, walk-in, referral… */
  source: text("source").notNull().default("website"),
  /** new | contacted | demo_booked | won | lost */
  status: text("status").notNull().default("new"),
  /** Private sales notes. */
  notes: text("notes").notNull().default(""),
  ...softDelete,
  ...timestamps,
}, (t) => ({ byCreated: index("leads_created_idx").on(t.createdAt) }));

// ── Capacity requests (GLOBAL — the super-admin's upgrade queue) ──────
// A center that hits its student limit taps a seat pack; that logs a request
// here AND opens WhatsApp pre-filled. The queue exists so requests don't live
// only in a chat thread — once you have a few hundred centers, WhatsApp alone
// stops being a system of record.
//
// Lifecycle: pending → payment_received → approved (capacity applied)
//            pending → declined (with a reason)
export const capacityRequests = pgTable("capacity_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  /** Seats asked for (25 / 50 / 100 — see SEAT_PACKS). */
  seats: integer("seats").notNull(),
  /** pending | payment_received | approved | declined */
  status: text("status").notNull().default("pending"),
  /** Snapshot at request time, so the queue reads correctly months later. */
  planCode: text("plan_code").notNull().default(""),
  planName: text("plan_name").notNull().default(""),
  activeStudents: integer("active_students").notNull().default(0),
  capAtRequest: integer("cap_at_request").notNull().default(0),
  /** Set when we advise a plan upgrade instead of another pack. */
  suggestedPlanCode: text("suggested_plan_code").notNull().default(""),
  notes: text("notes").notNull().default(""),
  handledBy: text("handled_by").notNull().default(""),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  byCreated: index("capacity_requests_created_idx").on(t.createdAt),
  byInstitute: index("capacity_requests_institute_idx").on(t.instituteId),
}));

// ── Capacity audit log (GLOBAL) ──────────────────────────────────────
// Every change to a center's effective student capacity, so "why do I have
// 250 seats?" always has an answer. Append-only: never update or delete a row.
export const capacityEvents = pgTable("capacity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  instituteId: uuid("institute_id").notNull().references(() => institutes.id, { onDelete: "cascade" }),
  /** plan_set | seats_added | seats_removed | plan_changed */
  action: text("action").notNull(),
  /** Seats added (+) or removed (−) by this event. 0 for a plain plan change. */
  delta: integer("delta").notNull().default(0),
  /** Effective cap AFTER this event. null = unlimited. */
  resultingCap: integer("resulting_cap"),
  planCode: text("plan_code").notNull().default(""),
  /** system | admin | owner */
  actor: text("actor").notNull().default("admin"),
  actorName: text("actor_name").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byInstitute: index("capacity_events_institute_idx").on(t.instituteId, t.createdAt),
}));
