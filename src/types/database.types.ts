/**
 * Hand-authored Supabase types covering the Phase-1 tables the app uses.
 * In a real project regenerate from the live DB:
 *   npm run db:types   (supabase gen types typescript --linked)
 * Keeping this file in sync is the source of truth for end-to-end typing.
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

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export type ProfileRow = Audit & {
  id: string;
  institute_id: string | null;
  role: UserRole;
  full_name: string;
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

type TableShape<R> = {
  Row: Row<R>;
  Insert: Insert<R>;
  Update: Update<R>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow>;
      institutes: TableShape<InstituteRow>;
      courses: TableShape<CourseRow>;
      batches: TableShape<BatchRow>;
      students: TableShape<StudentRow>;
      fees: TableShape<FeeRow>;
      payments: TableShape<PaymentRow>;
      message_templates: TableShape<MessageTemplateRow>;
      reminders: TableShape<ReminderRow>;
      receipts: TableShape<ReceiptRow>;
      activity_logs: TableShape<ActivityLogRow>;
      notifications: TableShape<NotificationRow>;
    };
    Views: Record<string, never>;
    Functions: {
      current_institute_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      increment_fee_payment: { Args: { p_fee_id: string; p_amount: number }; Returns: undefined };
      next_receipt_number: { Args: { p_institute_id: string }; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      gender: Gender;
      student_status: StudentStatus;
      fee_type: FeeType;
      fee_status: FeeStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      reminder_type: ReminderType;
      reminder_channel: ReminderChannel;
      delivery_status: DeliveryStatus;
      institute_type: InstituteType;
    };
  };
}
