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
