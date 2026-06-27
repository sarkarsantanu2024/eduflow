import type { Student } from "@/lib/store/local-db";
import { parseCsv, toCsv } from "@/lib/csv";

/** CSV columns for bulk import/export — header names map 1:1 to Student fields. */
export const STUDENT_COLUMNS: (keyof Student)[] = [
  "code", "firstName", "lastName", "gender", "dob", "admissionDate", "monthlyFee",
  "centreName", "hobbies", "siblingAge", "schoolName", "schoolClass",
  "address", "city", "pincode",
  "fatherName", "fatherContact", "motherName", "motherContact",
  "parentName", "parentMobile", "parentEmail", "status",
];

const blankStudent: Omit<Student, "id"> = {
  code: "", firstName: "", lastName: "", gender: "", dob: "", admissionDate: "",
  courseId: "", batchId: "", monthlyFee: 0, centreName: "", hobbies: "", siblingAge: "",
  schoolName: "", schoolClass: "", address: "", city: "", pincode: "",
  fatherName: "", fatherContact: "", motherName: "", motherContact: "",
  parentName: "", parentMobile: "", parentEmail: "", photo: "", status: "active",
};

/** Downloadable template: header row + one example row. */
export function studentTemplateCsv(): string {
  const example: Record<string, string> = {
    code: "MMA-0001", firstName: "Aarav", lastName: "Sharma", gender: "male",
    dob: "2016-04-12", admissionDate: "2026-01-15", monthlyFee: "500",
    centreName: "Barasat", hobbies: "Drawing", siblingAge: "3",
    schoolName: "DPS", schoolClass: "3", address: "Barasat, Kolkata", city: "Kolkata", pincode: "700124",
    fatherName: "Rohit Sharma", fatherContact: "9804243159", motherName: "Sita Sharma", motherContact: "9804243159",
    parentName: "Rohit Sharma", parentMobile: "9804243159", parentEmail: "parent@email.com", status: "active",
  };
  return toCsv([
    STUDENT_COLUMNS as string[],
    STUDENT_COLUMNS.map((k) => example[k] ?? ""),
  ]);
}

const VALID_STATUS = new Set<Student["status"]>(["active", "inactive", "graduated", "dropped"]);
const VALID_GENDER = new Set<Student["gender"]>(["male", "female", "other", ""]);

// ── Flexible import (any spreadsheet/CSV) ────────────────────────────
// Map common header names (from real school lists) to student fields.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ["name", "studentname", "student", "fullname", "childname"],
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "last", "surname"],
  code: ["code", "studentcode", "studentid", "admissionno", "admissionnumber", "rollno", "roll", "regno", "registrationno", "enrolmentno"],
  fatherName: ["fathersname", "fathername", "father", "guardianname", "guardian", "parentname", "parent"],
  fatherContact: ["phone", "mobile", "contact", "phoneno", "phonenumber", "mobileno", "mobilenumber", "contactno", "whatsapp", "fathercontact", "fatherphone", "parentmobile", "parentphone", "phone1"],
  motherName: ["mothername", "mother"],
  motherContact: ["mothercontact", "motherphone", "mothermobile", "phone2"],
  parentEmail: ["email", "parentemail", "emailid", "mailid", "mail"],
  address: ["address", "addr", "residence", "fulladdress"],
  city: ["city", "town"],
  pincode: ["pincode", "pin", "zip", "postalcode", "zipcode"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  admissionDate: ["dateofjoining", "admissiondate", "doj", "joiningdate", "joindate", "admission", "enroldate", "enrollmentdate", "dateofadmission"],
  course: ["level", "course", "batch", "program", "stage", "module"],
  schoolClass: ["schoolclass", "class", "standard", "grade"],
  schoolName: ["schoolname", "school"],
  gender: ["gender", "sex"],
  monthlyFee: ["monthlyfee", "fee", "fees", "monthlyfees"],
  status: ["status"],
};

/** Resolve a spreadsheet header to a student field (or "name", or null to skip). */
function fieldForHeader(header: string): string | null {
  const n = norm(header);
  for (const [field, syns] of Object.entries(HEADER_SYNONYMS)) {
    if (syns.includes(n)) return field;
  }
  return null;
}

/** Best-effort date → "YYYY-MM-DD" (handles Date objects, dd/mm/yyyy, Excel serials). */
function toIsoDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const d = dmy[1]!;
    const mo = dmy[2]!;
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]!;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const num = Number(s);
  if (!Number.isNaN(num) && num > 10_000 && num < 100_000) {
    // Excel serial date
    return new Date(Math.round((num - 25_569) * 86_400_000)).toISOString().slice(0, 10);
  }
  return "";
}

/** Target fields the user can map a spreadsheet column to (for the Map-columns UI). */
export const STUDENT_IMPORT_FIELDS: { value: string; label: string }[] = [
  { value: "ignore", label: "— Ignore —" },
  { value: "name", label: "Full name (split into first/last)" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "code", label: "Student ID / code" },
  { value: "fatherName", label: "Father / guardian name" },
  { value: "fatherContact", label: "Phone / mobile" },
  { value: "motherName", label: "Mother name" },
  { value: "motherContact", label: "Mother phone" },
  { value: "parentEmail", label: "Email" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "pincode", label: "Pincode" },
  { value: "dob", label: "Date of birth" },
  { value: "admissionDate", label: "Date of joining / admission" },
  { value: "course", label: "Course / Level (auto-created)" },
  { value: "schoolClass", label: "School class / grade" },
  { value: "schoolName", label: "School name" },
  { value: "gender", label: "Gender" },
  { value: "monthlyFee", label: "Monthly fee" },
  { value: "status", label: "Status" },
];

/** Auto-detect a header → field mapping (used as the default in the Map-columns UI). */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) map[h] = fieldForHeader(h) ?? "ignore";
  return map;
}

/** A parsed student plus the raw course/level text (resolved to a courseId on import). */
export type ImportedStudent = Omit<Student, "id"> & { _course?: string };

/** Apply one mapped value onto a record. Returns true if it was the full-name column. */
function applyField(rec: ImportedStudent, field: string, value: unknown, raw: string): boolean {
  if (field === "name") return true; // caller captures the full name
  if (field === "course") rec._course = raw; // resolved to a courseId at import time
  else if (field === "monthlyFee") rec.monthlyFee = Number(raw.replace(/[^\d.]/g, "")) || 0;
  else if (field === "gender") {
    const g = norm(raw);
    rec.gender = g.startsWith("m") ? "male" : g.startsWith("f") ? "female" : VALID_GENDER.has(raw as Student["gender"]) ? (raw as Student["gender"]) : "";
  } else if (field === "status") rec.status = VALID_STATUS.has(raw as Student["status"]) ? (raw as Student["status"]) : "active";
  else if (field === "dob" || field === "admissionDate") (rec as unknown as Record<string, string>)[field] = toIsoDate(value);
  else (rec as unknown as Record<string, string>)[field] = raw;
  return false;
}

/**
 * Build student records from rows-of-objects using an explicit header → field
 * mapping. Unknown/ignored columns are skipped; missing fields stay blank. No
 * blocking — any row with a name or phone is kept.
 */
export function buildStudents(rows: Record<string, unknown>[], mapping: Record<string, string>): ImportedStudent[] {
  return rows
    .map((row) => {
      const rec: ImportedStudent = { ...blankStudent };
      let fullName = "";
      for (const [header, value] of Object.entries(row)) {
        const field = mapping[header];
        if (!field || field === "ignore") continue;
        const raw = value == null ? "" : String(value).trim();
        if (!raw) continue;
        if (applyField(rec, field, value, raw)) fullName = raw;
      }
      if (fullName && !rec.firstName) {
        const parts = fullName.split(/\s+/);
        rec.firstName = parts.shift() ?? "";
        rec.lastName = parts.join(" ");
      }
      rec.parentName = rec.parentName || rec.fatherName || rec.motherName;
      rec.parentMobile = rec.parentMobile || rec.fatherContact || rec.motherContact;
      return rec;
    })
    .filter((r) => r.firstName || r.fatherName || r.parentMobile);
}

/** Flexible importer with auto-detected mapping (used when the user skips manual mapping). */
export function parseStudentsFromSheet(rows: Record<string, unknown>[]): Omit<Student, "id">[] {
  const headers = rows.length ? Object.keys(rows[0]!) : [];
  return buildStudents(rows, autoDetectMapping(headers));
}

/** Parse a CSV file's text into student records (without ids). */
export function parseStudentsCsv(text: string): Omit<Student, "id">[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());

  return rows.slice(1).map((cols) => {
    const rec: Omit<Student, "id"> = { ...blankStudent };
    header.forEach((key, i) => {
      const raw = (cols[i] ?? "").trim();
      if (!(STUDENT_COLUMNS as string[]).includes(key)) return;
      if (key === "monthlyFee") rec.monthlyFee = Number(raw) || 0;
      else if (key === "status") rec.status = VALID_STATUS.has(raw as Student["status"]) ? (raw as Student["status"]) : "active";
      else if (key === "gender") rec.gender = VALID_GENDER.has(raw as Student["gender"]) ? (raw as Student["gender"]) : "";
      else (rec as unknown as Record<string, string>)[key] = raw;
    });
    // keep parent fields in sync for reminders/fees
    rec.parentName = rec.parentName || rec.fatherName || rec.motherName;
    rec.parentMobile = rec.parentMobile || rec.fatherContact || rec.motherContact;
    return rec;
  }).filter((r) => r.firstName || r.code);
}
