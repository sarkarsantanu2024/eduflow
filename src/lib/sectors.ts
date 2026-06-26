/**
 * Sector registry — the single source of truth that makes EduFlow feel
 * purpose-built for each kind of institute.
 *
 * One config per sector declares:
 *  - terminology  (Student → Member, Course → Level/Subject/Dance form …)
 *  - modules      (which optional features light up in the sidebar)
 *  - seedCourses  (the sample curriculum loaded by "Load sample data")
 *  - seedTemplates(the sample WhatsApp messages tuned to that sector)
 *
 * Everything else (sidebar, forms, onboarding, sample data) reads from here,
 * so adding/adjusting a sector is a one-file change.
 */

/** Optional feature modules that a sector can switch on. Core modules
 *  (students, fees, reminders, dashboard) are always on and not listed here. */
export type ModuleKey =
  | "attendance" // present/absent + WhatsApp absent-alert
  | "promotions" // level / grade promotion engine
  | "tests" // test scores + rank lists
  | "certificates" // issue / print / QR-verify certificates
  | "examBoards" // external exam-board registration (NIELIT, BSP, IGE…)
  | "performance" // competitions / recitals / contests log
  | "materials" // kit / costume / material issuance
  | "events"; // annual function / exhibition

export const ALL_MODULES: ModuleKey[] = [
  "attendance", "promotions", "tests", "certificates", "examBoards", "performance", "materials", "events",
];

/** Human-readable module labels (used by the Profile module preview). */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  attendance: "Attendance",
  promotions: "Level / Grade promotion",
  tests: "Tests & rank lists",
  certificates: "Certificates",
  examBoards: "Exam-board registration",
  performance: "Performance / competitions",
  materials: "Materials / kit",
  events: "Events & functions",
};

export interface SectorLabels {
  member: string;
  members: string;
  courses: string;
  batches: string;
}

export interface SeedCourse {
  name: string;
  description: string;
}

export interface SeedTemplate {
  name: string;
  type: string;
  body: string;
}

export interface SectorConfig {
  value: string;
  label: string; // shown in the Business-type dropdown
  tagline: string; // short demo blurb
  /** terminology */
  member: string;
  members: string;
  courses: string;
  batches: string;
  /** which optional modules are on for this sector */
  modules: ModuleKey[];
  /** sample curriculum + messages loaded by "Load sample data" */
  seedCourses: SeedCourse[];
  seedTemplates: SeedTemplate[];
}

// Messages every sector shares (fee lifecycle + housekeeping).
const COMMON_TEMPLATES: SeedTemplate[] = [
  { name: "Fee Due Reminder", type: "fee_due", body: "Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. Please pay via the UPI QR we sent. — {{business}}" },
  { name: "Fee Overdue", type: "fee_overdue", body: "Reminder: ₹{{amount}} for {{student_name}} is overdue. Kindly clear it at the earliest. — {{business}}" },
  { name: "Absent Today", type: "absent", body: "Dear {{parent_name}}, {{student_name}} was marked absent today. Please ensure regular attendance. — {{business}}" },
  { name: "Birthday Wish", type: "birthday", body: "Happy Birthday {{student_name}}! 🎉 Wishing you a wonderful year ahead. — {{business}}" },
  { name: "Holiday Notice", type: "holiday_notice", body: "Dear parents, the centre will remain closed on {{date}} for {{occasion}}. — {{business}}" },
];

export const SECTORS: SectorConfig[] = [
  {
    value: "abacus",
    label: "Abacus Center",
    tagline: "Levels, speed tests, competitions & graduation certificates.",
    member: "Student", members: "Students", courses: "Levels", batches: "Batches",
    modules: ["attendance", "promotions", "certificates", "examBoards", "performance", "materials"],
    seedCourses: [
      { name: "Foundation 1", description: "Bead introduction, single digit" },
      { name: "Foundation 2", description: "Small numbers, short chains" },
      { name: "Level 1", description: "Simple addition / subtraction" },
      { name: "Level 2", description: "Small Friend concept" },
      { name: "Level 3", description: "Big Friend concept" },
      { name: "Level 4", description: "Mix Friend" },
      { name: "Level 5", description: "Three-digit operations" },
      { name: "Level 6", description: "Multiplication basics" },
      { name: "Level 7", description: "Division basics" },
      { name: "Level 8 (Grand)", description: "Advanced all operations" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Level Promotion", type: "promotion", body: "Congratulations! {{student_name}} has cleared the assessment and is promoted to {{level}}. 🎉 Proud of the progress! — {{business}}" },
      { name: "Speed Test Result", type: "result", body: "{{student_name}} scored {{score}} in today's speed test. Great mental-maths work! — {{business}}" },
      { name: "Competition Notice", type: "competition", body: "Dear parent, {{student_name}} is selected for the {{event}} abacus competition on {{date}}. Entry fee ₹{{amount}}. — {{business}}" },
      { name: "Certificate Ready", type: "certificate", body: "{{student_name}}'s {{level}} completion certificate is ready for collection. — {{business}}" },
    ],
  },
  {
    value: "coaching",
    label: "Coaching Center",
    tagline: "Subject-wise batches, test ranks & board-exam tracking.",
    member: "Student", members: "Students", courses: "Subjects", batches: "Batches",
    modules: ["attendance", "tests", "examBoards"],
    seedCourses: [
      { name: "Physics", description: "Class 11–12 / WBJEE / NEET" },
      { name: "Chemistry", description: "Class 11–12 / WBJEE / NEET" },
      { name: "Mathematics", description: "Class 11–12 / WBJEE / JEE" },
      { name: "Biology", description: "Class 11–12 / NEET" },
      { name: "English", description: "Madhyamik & HS board" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Test Score & Rank", type: "result", body: "{{student_name}} scored {{score}} in the {{test}} test — Rank {{rank}} in the batch. Keep it up! — {{business}}" },
      { name: "Mock Test Schedule", type: "test_schedule", body: "Dear parent, a full-syllabus mock test for {{student_name}}'s batch is on {{date}}. Please ensure attendance. — {{business}}" },
      { name: "PTM Notice", type: "ptm", body: "Parent–Teacher Meeting on {{date}} to discuss {{student_name}}'s performance. — {{business}}" },
    ],
  },
  {
    value: "computer",
    label: "Computer Training Institute",
    tagline: "Diploma courses (DCA/Tally), lab batches & verified certificates.",
    member: "Student", members: "Students", courses: "Courses", batches: "Batches",
    modules: ["attendance", "promotions", "certificates", "examBoards"],
    seedCourses: [
      { name: "DCA", description: "Diploma in Computer Application · 6 months" },
      { name: "ADCA", description: "Advanced Diploma · 12 months" },
      { name: "Tally Prime + GST", description: "Accounting · 3 months" },
      { name: "MS Office", description: "Word, Excel, PowerPoint · 3 months" },
      { name: "DTP", description: "PageMaker, CorelDraw, Photoshop · 4 months" },
      { name: "CCC", description: "Course on Computer Concepts (NIELIT)" },
      { name: "O-Level", description: "NIELIT O-Level · 1 year" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Admission Confirmed", type: "admission", body: "Welcome {{student_name}}! Admission confirmed for {{course}}. Roll no: {{roll}}. Classes start {{date}}. — {{business}}" },
      { name: "Exam Schedule", type: "exam", body: "Dear {{student_name}}, your {{course}} theory & practical exam is on {{date}}. All the best! — {{business}}" },
      { name: "Certificate Ready", type: "certificate", body: "Congratulations {{student_name}}! Your {{course}} certificate is issued. Verify online or collect from the centre. — {{business}}" },
    ],
  },
  {
    value: "dance",
    label: "Dance School",
    tagline: "Dance forms, grade exams, recitals & the annual function.",
    member: "Student", members: "Students", courses: "Dance Forms", batches: "Batches",
    modules: ["attendance", "promotions", "examBoards", "performance", "materials", "events"],
    seedCourses: [
      { name: "Kathak", description: "Classical · graded" },
      { name: "Bharatanatyam", description: "Classical · graded" },
      { name: "Odissi", description: "Classical · graded" },
      { name: "Rabindra Nritya", description: "Tagore dance" },
      { name: "Creative / Bollywood", description: "Western & freestyle" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Grade Promotion", type: "promotion", body: "Congratulations! {{student_name}} has cleared {{level}} and moves to the next grade. 💃 — {{business}}" },
      { name: "Annual Function Invite", type: "event", body: "You're invited! {{student_name}} performs at our Annual Function on {{date}} at {{venue}}. Don't miss it! — {{business}}" },
      { name: "Board Exam Registration", type: "exam", body: "Dear parent, registration for the {{board}} dance exam closes on {{date}}. Fee ₹{{amount}}. — {{business}}" },
      { name: "Rehearsal Schedule", type: "rehearsal", body: "Rehearsal for {{student_name}}'s item is on {{date}} at {{time}}. Please be on time. — {{business}}" },
    ],
  },
  {
    value: "drawing",
    label: "Drawing / Art School",
    tagline: "Mediums, graded art exams, contests & exhibitions.",
    member: "Student", members: "Students", courses: "Courses", batches: "Batches",
    modules: ["attendance", "promotions", "examBoards", "performance", "materials", "events"],
    seedCourses: [
      { name: "Pencil Sketching", description: "Shading & still life" },
      { name: "Watercolour", description: "Wash & landscape" },
      { name: "Acrylic Painting", description: "Canvas work" },
      { name: "Elementary Exam Prep", description: "Govt Elementary drawing grade" },
      { name: "Intermediate Exam Prep", description: "Govt Intermediate drawing grade" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Exam Registration", type: "exam", body: "Dear parent, {{board}} drawing exam registration for {{student_name}} closes on {{date}}. Fee ₹{{amount}}. — {{business}}" },
      { name: "Competition Notice", type: "competition", body: "{{student_name}} can participate in the {{event}} art contest. Submission by {{date}}. — {{business}}" },
      { name: "Exhibition Invite", type: "event", body: "Our students' art exhibition is on {{date}} at {{venue}}. {{student_name}}'s work will be on display! — {{business}}" },
    ],
  },
  {
    value: "spoken_english",
    label: "Spoken English Center",
    tagline: "Proficiency modules, level promotion & daily practice.",
    member: "Student", members: "Students", courses: "Modules", batches: "Batches",
    modules: ["attendance", "promotions", "certificates"],
    seedCourses: [
      { name: "Foundation (Basic)", description: "Grammar & vocabulary base" },
      { name: "Fluency (Intermediate)", description: "Conversation practice" },
      { name: "Mastery (Advanced)", description: "Public speaking & accent" },
      { name: "Personality Development", description: "Interview & soft skills" },
      { name: "Kids Spoken English", description: "Ages 6–12" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Demo Class Invite", type: "demo", body: "Hi {{parent_name}}, a free spoken-English demo class is on {{date}} at {{time}}. Bring {{student_name}} along! — {{business}}" },
      { name: "Level Promotion", type: "promotion", body: "Well done! {{student_name}} has completed {{level}} and is promoted to the next module. 🗣️ — {{business}}" },
      { name: "Daily Practice", type: "practice", body: "Today's practice for {{student_name}}: speak 5 sentences about {{topic}}. Send us a voice note! — {{business}}" },
    ],
  },
  {
    value: "tuition",
    label: "Tuition Center",
    tagline: "Multi-subject batches, fees, attendance & test marks.",
    member: "Student", members: "Students", courses: "Subjects", batches: "Batches",
    modules: ["attendance", "tests"],
    seedCourses: [
      { name: "Mathematics", description: "Class 6–12" },
      { name: "Science", description: "Class 6–10" },
      { name: "English", description: "Class 6–12" },
      { name: "Physics", description: "Class 11–12" },
      { name: "Accountancy", description: "Class 11–12" },
    ],
    seedTemplates: [
      ...COMMON_TEMPLATES,
      { name: "Test Marks", type: "result", body: "{{student_name}} scored {{score}} in the {{test}} test. — {{business}}" },
      { name: "Class Rescheduled", type: "reschedule", body: "Dear parent, {{student_name}}'s class on {{date}} is rescheduled to {{time}}. — {{business}}" },
    ],
  },
  {
    value: "other",
    label: "Other / General",
    tagline: "A flexible setup for any small institute.",
    member: "Member", members: "Members", courses: "Courses", batches: "Batches",
    modules: ["attendance"],
    seedCourses: [
      { name: "Course 1", description: "Sample course" },
      { name: "Course 2", description: "Sample course" },
    ],
    seedTemplates: [...COMMON_TEMPLATES],
  },
];

export interface Faq {
  q: string;
  a: string;
}

// Shown for every sector.
const COMMON_FAQS: Faq[] = [
  { q: "How do I send a fee reminder on WhatsApp?", a: "Open Fees, tap Reminder next to a student, then 'Send on WhatsApp'. It opens WhatsApp with the message ready — you just press send. Free, from your own number." },
  { q: "Can I record cash payments?", a: "Yes. In Fees, use Collect and choose the amount — it records the payment and history whether the parent paid by UPI QR or cash." },
  { q: "How do I add my UPI QR for collections?", a: "Go to Profile → Payment details and upload your PhonePe/GPay/Paytm QR. It then shows automatically inside every fee reminder." },
  { q: "Will my data be safe?", a: "Yes. Each institute's data is private to that account. (In the current demo it's saved in your browser; on the live plan it's stored securely in the cloud.)" },
];

// Extra, sector-specific questions.
const SECTOR_FAQS: Record<string, Faq[]> = {
  abacus: [
    { q: "How do I promote a student to the next level?", a: "Open Promotions, choose the student and the new level, add the assessment score, and send the parent an automatic WhatsApp congratulations." },
    { q: "Can I issue level-completion certificates?", a: "Yes. Go to Certificates, issue one for the level — print it or save as PDF with a scannable verify QR." },
    { q: "Can I track competition results?", a: "Use Performance to log state/national competition ranks and share them with parents on WhatsApp." },
  ],
  coaching: [
    { q: "How do I publish a test rank list?", a: "In Tests & Ranks, add each student's score for a test. The rank list is calculated automatically and you can send each parent a score + rank card on WhatsApp." },
    { q: "Can I track different exam batches (WBJEE/NEET)?", a: "Yes. Create a batch per exam target and assign students and subject teachers to it." },
  ],
  computer: [
    { q: "How do I issue a verifiable certificate (DCA/Tally)?", a: "Go to Certificates, pick the course, and issue. You get a printable PDF with a QR a parent or employer can scan to verify." },
    { q: "Can I track NIELIT / WEBEL exam registration?", a: "Yes. Use Exam Boards to register students, track admit cards and results, and notify parents." },
  ],
  dance: [
    { q: "How do I invite parents to the annual function?", a: "Add the event under Events, then tap 'Preview invite' to send a WhatsApp invitation message." },
    { q: "Can I track grade exam registration (BSP/Prayag)?", a: "Yes. Use Exam Boards to register students for dance-board exams and track fees, admit cards and results." },
    { q: "Can I record costume issuance?", a: "Use Materials to track costumes/kits issued to each student, free or charged." },
  ],
  drawing: [
    { q: "How do I track drawing-exam registration?", a: "Use Exam Boards for Elementary/Intermediate or BSP exam registration, fees and results." },
    { q: "Can I log art competition results?", a: "Yes. Use Performance to record contest participation and results and share them with parents." },
  ],
  spoken_english: [
    { q: "How do I run a free demo class funnel?", a: "Use the 'Demo Class Invite' WhatsApp template to invite prospects, then enrol them and promote between modules as they progress." },
    { q: "How do I promote a student to the next module?", a: "Open Promotions, move them from one module to the next, and send an automatic WhatsApp congratulations." },
  ],
  tuition: [
    { q: "How do I share test marks with parents?", a: "Use Tests & Ranks to record marks and send each parent a result on WhatsApp." },
    { q: "Can a student take multiple subjects?", a: "Yes. Create a batch per subject and assign students and tutors to each." },
  ],
};

/** FAQs for a sector — common questions plus that sector's specifics. */
export function getFaqs(businessType: string | undefined): Faq[] {
  const sector = getSector(businessType).value;
  return [...COMMON_FAQS, ...(SECTOR_FAQS[sector] ?? [])];
}

const DEFAULT_SECTOR = SECTORS.find((s) => s.value === "other")!;

/** Dropdown list for the Business-type select. */
export const BUSINESS_TYPES = SECTORS.map((s) => ({ value: s.value, label: s.label }));

/** Look up a sector config (falls back to the generic "other" sector). */
export function getSector(businessType: string | undefined): SectorConfig {
  return SECTORS.find((s) => s.value === businessType) ?? DEFAULT_SECTOR;
}

/** Terminology for a sector (kept for backward compatibility). */
export function getLabels(businessType: string | undefined): SectorLabels {
  const s = getSector(businessType);
  return { member: s.member, members: s.members, courses: s.courses, batches: s.batches };
}

/** Returns true if a module is enabled for the given sector. */
export function isModuleEnabled(businessType: string | undefined, module: ModuleKey): boolean {
  return getSector(businessType).modules.includes(module);
}
