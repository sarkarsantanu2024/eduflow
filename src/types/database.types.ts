/**
 * Shared application row/enum types used across the UI layer.
 * The database schema itself is defined with Drizzle in src/lib/db/schema.ts
 * (Neon Postgres); these hand-authored types mirror the shapes the client uses.
 */

export type UserRole = "super_admin" | "institute_admin" | "teacher" | "parent";
export type Gender = "male" | "female" | "other";
export type StudentStatus = "active" | "inactive" | "graduated" | "dropped";
export type FeeType = "monthly" | "admission" | "exam" | "other";
export type FeeStatus = "pending" | "partial" | "paid" | "overdue" | "waived";
export type PaymentStatus = "created" | "pending" | "success" | "failed" | "refunded";
export type PaymentMethod = "razorpay" | "cash" | "upi" | "bank_transfer" | "cheque" | "other";
export type ReminderType =
  | "fee_due" | "fee_overdue" | "admission_renewal" | "exam_reminder"
  | "birthday" | "holiday_notice" | "custom";
export type ReminderChannel = "whatsapp" | "email" | "sms";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type InstituteType =
  | "abacus" | "coaching" | "tuition" | "dance" | "music"
  | "spoken_english" | "computer_training" | "other";

type Audit = {
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ProfileRow = Audit & {
  id: string;
  institute_id: string | null;
  role: UserRole;
  full_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export type InstituteRow = Audit & {
  id: string;
  name: string;
  slug: string;
  type: InstituteType;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gst_number: string | null;
  timezone: string;
  currency: string;
  is_active: boolean;
}

export type CourseRow = Audit & {
  id: string;
  institute_id: string;
  name: string;
  description: string | null;
  duration_months: number | null;
  monthly_fee: number;
  admission_fee: number;
  is_active: boolean;
}

export type BatchRow = Audit & {
  id: string;
  institute_id: string;
  course_id: string | null;
  teacher_id: string | null;
  name: string;
  timing: string | null;
  days: string[];
  capacity: number | null;
  is_active: boolean;
}

export type StudentRow = Audit & {
  id: string;
  institute_id: string;
  student_code: string;
  first_name: string;
  last_name: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  admission_date: string;
  course_id: string | null;
  primary_batch_id: string | null;
  parent_id: string | null;
  parent_name: string | null;
  parent_mobile: string | null;
  parent_email: string | null;
  address: string | null;
  photo_url: string | null;
  status: StudentStatus;
}

export type FeeRow = Audit & {
  id: string;
  institute_id: string;
  student_id: string;
  course_id: string | null;
  fee_type: FeeType;
  title: string;
  amount: number;
  amount_paid: number;
  discount: number;
  period_month: number | null;
  period_year: number | null;
  due_date: string;
  status: FeeStatus;
  notes: string | null;
}

export type PaymentRow = Audit & {
  id: string;
  institute_id: string;
  student_id: string;
  fee_id: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_link_url: string | null;
  paid_at: string | null;
  notes: string | null;
}

export type MessageTemplateRow = Audit & {
  id: string;
  institute_id: string;
  name: string;
  reminder_type: ReminderType;
  channel: ReminderChannel;
  whatsapp_template_name: string | null;
  language: string;
  body: string;
  variables: string[];
  is_active: boolean;
}

export type ReminderRow = Audit & {
  id: string;
  institute_id: string;
  student_id: string | null;
  fee_id: string | null;
  template_id: string | null;
  reminder_type: ReminderType;
  channel: ReminderChannel;
  recipient: string;
  rendered_body: string;
  status: DeliveryStatus;
  provider_message_id: string | null;
  scheduled_for: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
}

export type ReceiptRow = Audit & {
  id: string;
  institute_id: string;
  payment_id: string;
  student_id: string;
  receipt_number: string;
  amount: number;
  pdf_url: string | null;
  issued_at: string;
};

export type ActivityLogRow = {
  id: string;
  institute_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  institute_id: string | null;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

