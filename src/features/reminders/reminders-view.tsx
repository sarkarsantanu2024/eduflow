"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Plus, Pencil, Trash2, Users, Copy, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { AutomationPanel } from "@/features/automation/automation-panel";
import { renderTemplate, waLink } from "@/lib/wa-link";
import { queueAnnouncement } from "@/features/automation/actions";
import { getSector } from "@/lib/sectors";
import { formatDate } from "@/lib/utils";
import { useCanManage } from "@/components/layout/role-context";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, removeItem, newId,
  type Template, type Student, type Fee,
} from "@/lib/store/local-db";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";
const inputClass = selectClass;
const textareaClass =
  "min-h-28 w-full rounded-lg border border-input bg-card p-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Old default wordings (per name, across all sectors) — any template still on
 * one of these is auto-upgraded once to its sector's professional version.
 * Edited templates never match, so they're left untouched.
 */
const LEGACY_BODIES: Record<string, string[]> = {
  "Fee Due Reminder": ["Hi {{parent_name}}, the fee of ₹{{amount}} for {{student_name}} is due on {{due_date}}. Please pay via the UPI QR we sent. — {{business}}"],
  "Fee Overdue": ["Reminder: ₹{{amount}} for {{student_name}} is overdue. Kindly clear it at the earliest. — {{business}}"],
  "Absent Today": ["Dear {{parent_name}}, {{student_name}} was marked absent today. Please ensure regular attendance. — {{business}}"],
  "Birthday Wish": ["Happy Birthday {{student_name}}! 🎉 Wishing you a wonderful year ahead. — {{business}}"],
  "Holiday Notice": ["Dear parents, the centre will remain closed on {{date}} for {{occasion}}. — {{business}}"],
  "Level Promotion": [
    "Congratulations! {{student_name}} has cleared the assessment and is promoted to {{level}}. 🎉 Proud of the progress! — {{business}}",
    "Well done! {{student_name}} has completed {{level}} and is promoted to the next module. 🗣️ — {{business}}",
  ],
  "Speed Test Result": ["{{student_name}} scored {{score}} in today's speed test. Great mental-maths work! — {{business}}"],
  "Competition Notice": [
    "Dear parent, {{student_name}} is selected for the {{event}} abacus competition on {{date}}. Entry fee ₹{{amount}}. — {{business}}",
    "{{student_name}} can participate in the {{event}} art contest. Submission by {{date}}. — {{business}}",
  ],
  "Certificate Ready": [
    "{{student_name}}'s {{level}} completion certificate is ready for collection. — {{business}}",
    "Congratulations {{student_name}}! Your {{course}} certificate is issued. Verify online or collect from the centre. — {{business}}",
  ],
  "Test Score & Rank": ["{{student_name}} scored {{score}} in the {{test}} test — Rank {{rank}} in the batch. Keep it up! — {{business}}"],
  "Mock Test Schedule": ["Dear parent, a full-syllabus mock test for {{student_name}}'s batch is on {{date}}. Please ensure attendance. — {{business}}"],
  "PTM Notice": ["Parent–Teacher Meeting on {{date}} to discuss {{student_name}}'s performance. — {{business}}"],
  "Admission Confirmed": ["Welcome {{student_name}}! Admission confirmed for {{course}}. Roll no: {{roll}}. Classes start {{date}}. — {{business}}"],
  "Exam Schedule": ["Dear {{student_name}}, your {{course}} theory & practical exam is on {{date}}. All the best! — {{business}}"],
  "Grade Promotion": ["Congratulations! {{student_name}} has cleared {{level}} and moves to the next grade. 💃 — {{business}}"],
  "Annual Function Invite": ["You're invited! {{student_name}} performs at our Annual Function on {{date}} at {{venue}}. Don't miss it! — {{business}}"],
  "Board Exam Registration": ["Dear parent, registration for the {{board}} dance exam closes on {{date}}. Fee ₹{{amount}}. — {{business}}"],
  "Rehearsal Schedule": ["Rehearsal for {{student_name}}'s item is on {{date}} at {{time}}. Please be on time. — {{business}}"],
  "Exam Registration": ["Dear parent, {{board}} drawing exam registration for {{student_name}} closes on {{date}}. Fee ₹{{amount}}. — {{business}}"],
  "Exhibition Invite": ["Our students' art exhibition is on {{date}} at {{venue}}. {{student_name}}'s work will be on display! — {{business}}"],
  "Demo Class Invite": ["Hi {{parent_name}}, a free spoken-English demo class is on {{date}} at {{time}}. Bring {{student_name}} along! — {{business}}"],
  "Daily Practice": ["Today's practice for {{student_name}}: speak 5 sentences about {{topic}}. Send us a voice note! — {{business}}"],
  "Test Marks": ["{{student_name}} scored {{score}} in the {{test}} test. — {{business}}"],
  "Class Rescheduled": ["Dear parent, {{student_name}}'s class on {{date}} is rescheduled to {{time}}. — {{business}}"],
};

function fields(t?: Template): FormField[] {
  return [
    { name: "name", label: "Template name", required: true, defaultValue: t?.name,
      placeholder: "e.g. Fee received – thank you" },
    { name: "body", label: "Message", type: "textarea", required: true, defaultValue: t?.body,
      placeholder: "Dear {{parent_name}}, … — {{business}}" },
  ];
}

const nameOf = (s: Student) => `${s.firstName} ${s.lastName}`.trim();
const mobileOf = (s: Student) => s.parentMobile || s.fatherContact || "";
const prettyToken = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const isDateToken = (t: string) => t === "date" || t.endsWith("_date") || t.includes("date");

function extractTokens(body: string, auto: Set<string>): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const key = m[1];
    if (key && !auto.has(key)) found.add(key);
  }
  return [...found];
}

// Ready-made announcement starters — general messages for the whole group.
// They use only broadcast-safe variables (never per-student), so they render
// clean fill-in fields and are always available in the Announcement tab.
const ANNOUNCEMENT_STARTERS: { name: string; body: string }[] = [
  { name: "Holiday", body: "Dear Parents, please note that {{business}} will remain closed on {{date}} on account of {{occasion}}. Regular classes will resume on the next working day. Thank you. — {{business}}" },
  { name: "Centre closed today", body: "Dear Parents, please note that today's classes at {{business}} are cancelled due to {{reason}}. We regret the inconvenience and will resume as usual tomorrow. Thank you. — {{business}}" },
  { name: "Event / Function", body: "Dear Parents, you are cordially invited to {{event}} on {{date}} at {{venue}}. We look forward to your presence. — {{business}}" },
  { name: "Exam notice", body: "Dear Parents, please note that the {{exam}} examinations at {{business}} will be held from {{date}}. Kindly ensure timely preparation and attendance. — {{business}}" },
  { name: "Monthly fee reminder", body: "Dear Parents, this is a gentle reminder that the monthly fees for {{month}} are now due. Kindly pay at your convenience using the UPI ID/QR shared with you. Thank you. — {{business}}" },
  { name: "General notice", body: "Dear Parents, {{notice}} Thank you. — {{business}}" },
];
const STARTER_NAMES = new Set(ANNOUNCEMENT_STARTERS.map((s) => s.name.toLowerCase()));

// Tokens that make a template about ONE student — such templates belong in the
// "To one parent" tab, never in a group announcement.
const PER_STUDENT_TOKENS = new Set([
  "student_name", "parent_name", "amount", "due_date", "level", "course",
  "score", "rank", "roll", "test", "topic", "months",
]);
function isBroadcastTemplate(body: string): boolean {
  return extractTokens(body, new Set()).every((t) => !PER_STUDENT_TOKENS.has(t));
}

const BASE_AUTO_KEYS = ["student_name", "parent_name", "business", "level", "course"];
const FEE_AUTO_KEYS = ["amount", "due_date", "months"];

/**
 * Everything we can auto-fill about a student. Fee figures (amount/due/months)
 * come from their real pending MONTHLY fees and are only included for fee-reminder
 * templates — other templates' {{amount}} (exam/competition fee) stays a blank.
 */
function studentVars(s: Student, biz: string, courseName: string, fees: Fee[], includeFees: boolean): Record<string, string> {
  const base: Record<string, string> = {
    student_name: s.firstName,
    parent_name: s.parentName || s.fatherName || "Parent",
    business: biz,
    level: courseName,
    course: courseName,
  };
  if (!includeFees) return base;
  const mine = fees.filter((f) => f.studentId === s.id && f.kind === "monthly");
  const unpaid = mine.filter((f) => f.status !== "paid");
  const outstanding = unpaid.reduce((a, f) => a + (f.amount - f.amountPaid), 0);
  const ym = new Date().toISOString().slice(0, 7);
  const due = (mine.find((f) => f.period === ym) ?? unpaid[0])?.dueDate ?? "";
  return {
    ...base,
    amount: outstanding ? String(outstanding) : "",
    due_date: due ? formatDate(due) : "",
    months: String(unpaid.length),
  };
}

/** Build the final message: auto-vars + whatever the user typed into the blanks. */
function composeMessage(body: string, autoVars: Record<string, string>, vals: Record<string, string>): string {
  const tokens = extractTokens(body, new Set(Object.keys(autoVars)));
  const filled: Record<string, string> = { ...autoVars };
  tokens.forEach((t) => {
    if (isDateToken(t)) {
      const from = vals[t] ?? "";
      const to = vals[`${t}__to`] ?? "";
      filled[t] = from ? (to && to !== from ? `${formatDate(from)} – ${formatDate(to)}` : formatDate(from)) : "";
    } else {
      filled[t] = vals[t] ?? "";
    }
  });
  return renderTemplate(body, filled);
}

/** Labeled input for each remaining {{blank}} — dates get a from/to picker. */
function FillFields({ tokens, vals, setVals }: {
  tokens: string[];
  vals: Record<string, string>;
  setVals: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  if (tokens.length === 0) return null;
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
      {tokens.map((t) => (
        isDateToken(t) ? (
          <div key={t} className="space-y-1.5 sm:col-span-2">
            <Label>{prettyToken(t)} — from / to</Label>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} type="date" value={vals[t] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [t]: e.target.value }))} />
              <input className={inputClass} type="date" value={vals[`${t}__to`] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [`${t}__to`]: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Leave &quot;to&quot; empty for a single day.</p>
          </div>
        ) : (
          <div key={t} className="space-y-1.5">
            <Label>{prettyToken(t)}</Label>
            <input className={inputClass} value={vals[t] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [t]: e.target.value }))} placeholder={prettyToken(t)} />
          </div>
        )
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Users; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

/* ── One card, two ways to send: to a single parent, or an announcement ── */
function SendPanel({
  students, templates, fees, biz, courseName,
}: {
  students: Student[]; templates: Template[]; fees: Fee[]; biz: string; courseName: (id: string) => string;
}) {
  const [mode, setMode] = useState<"one" | "group">("one");

  // ── One parent: pick a student, their details auto-fill; fill any blanks ──
  // Only personalized templates here — group/broadcast ones (e.g. Holiday
  // Notice) live in the Announcement tab.
  const oneParentTemplates = useMemo(() => templates.filter((t) => !isBroadcastTemplate(t.body)), [templates]);
  const [studentId, setStudentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [oneVals, setOneVals] = useState<Record<string, string>>({});
  useEffect(() => { setOneVals({}); }, [templateId, studentId]);
  const student = students.find((s) => s.id === studentId);
  const oneMobile = student ? mobileOf(student) : "";
  const oneTpl = templates.find((t) => t.id === templateId);
  const oneBody = oneTpl?.body ?? "";
  const isFeeTpl = oneTpl?.type === "fee_due" || oneTpl?.type === "fee_overdue";
  const autoVars = student ? studentVars(student, biz, courseName(student.courseId), fees, isFeeTpl) : {};
  const oneTokens = extractTokens(oneBody, new Set(isFeeTpl ? [...BASE_AUTO_KEYS, ...FEE_AUTO_KEYS] : BASE_AUTO_KEYS));
  const oneMissing = oneTokens.filter((t) => !(oneVals[t] ?? "").trim());
  const oneMsg = composeMessage(oneBody, autoVars, oneVals);

  // ── Announcement: general message to all parents (broadcast templates only) ──
  const broadcastTemplates = useMemo(() => templates.filter((t) => isBroadcastTemplate(t.body)), [templates]);
  const [body, setBody] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const tokens = extractTokens(body, new Set(["business"]));
  const missing = tokens.filter((t) => !(vals[t] ?? "").trim());
  const groupMsg = composeMessage(body, { business: biz }, vals);

  async function queueForAllParents() {
    try {
      const n = await queueAnnouncement(groupMsg);
      toast.success(`Queued for ${n} parent${n === 1 ? "" : "s"}`, {
        description: "Open the Outbox above — one tap per parent sends it from your WhatsApp.",
      });
    } catch {
      toast.error("Couldn't queue — try again.");
    }
  }

  async function copyGroup() {
    try {
      await navigator.clipboard.writeText(groupMsg);
      toast.success("Message copied", { description: "Paste it into your parents' WhatsApp group." });
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="inline-grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <TabBtn active={mode === "one"} onClick={() => setMode("one")} icon={UserRound}>To one parent</TabBtn>
          <TabBtn active={mode === "group"} onClick={() => setMode("group")} icon={Users}>Announcement</TabBtn>
        </div>

        {mode === "one" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Parent / student</Label>
                <select className={selectClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  <option value="">Select a student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{nameOf(s)}{mobileOf(s) ? "" : " (no number)"}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Template</Label>
                <select className={selectClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!student}>
                  <option value="">Select a template…</option>
                  {oneParentTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            {student && templateId && (
              <>
                <p className="text-xs text-muted-foreground">
                  Name, parent, level and any pending fee are filled in automatically from {student.firstName}&apos;s record.
                </p>
                <FillFields tokens={oneTokens} vals={oneVals} setVals={setOneVals} />
                <div className="space-y-1.5">
                  <Label>Preview</Label>
                  <div className="rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
                    {oneMsg}
                  </div>
                </div>
                {oneMissing.length > 0 && (
                  <p className="text-xs font-medium text-amber-600">Fill in: {oneMissing.map(prettyToken).join(", ")}</p>
                )}
                {!oneMobile ? (
                  <p className="text-sm text-muted-foreground">This student has no parent WhatsApp number saved.</p>
                ) : oneMissing.length > 0 ? (
                  <Button disabled>Fill the blanks above to send</Button>
                ) : (
                  <SendOnWhatsApp phone={oneMobile} message={oneMsg} label={`Send to ${student.parentName || student.fatherName || nameOf(student)}`} />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              A general message for <span className="font-medium text-foreground">all parents</span> — holidays, closures, events. For anything about a specific student, use <span className="font-medium text-foreground">To one parent</span>.
            </p>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea
                className={textareaClass}
                placeholder={`Dear parents, the centre will remain closed on {{date}} for {{occasion}}. — ${biz}`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Start from:</span>
                {ANNOUNCEMENT_STARTERS.map((s) => (
                  <button key={s.name} type="button" onClick={() => { setBody(s.body); setVals({}); }}
                    className="rounded-full border px-2 py-0.5 text-xs font-medium hover:bg-accent">
                    {s.name}
                  </button>
                ))}
                {broadcastTemplates.filter((t) => !STARTER_NAMES.has(t.name.toLowerCase())).map((t) => (
                  <button key={t.id} type="button" onClick={() => { setBody(t.body); setVals({}); }}
                    className="rounded-full border px-2 py-0.5 text-xs font-medium hover:bg-accent">
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <FillFields tokens={tokens} vals={vals} setVals={setVals} />

            {body.trim() && (
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div className="rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
                  {groupMsg}
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-sm font-medium">Send it out</p>
              <p className="mb-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Pick your group</span> opens WhatsApp with the message ready — just choose your parents&apos; group and press send. Or queue it for <span className="font-medium text-foreground">every parent individually</span> — more reliable than a group many parents keep muted.
              </p>
              {missing.length > 0 && (
                <p className="mb-2 text-xs font-medium text-amber-600">Fill in: {missing.map(prettyToken).join(", ")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild disabled={!groupMsg.trim() || missing.length > 0}>
                  <a href={waLink("", groupMsg)} target="_blank" rel="noopener noreferrer">
                    <Users /> Open WhatsApp — pick your group
                  </a>
                </Button>
                <Button size="sm" variant="outline" disabled={!groupMsg.trim() || missing.length > 0} onClick={queueForAllParents}>
                  <UserRound /> Queue for every parent
                </Button>
                <Button size="sm" variant="ghost" disabled={!groupMsg.trim() || missing.length > 0} onClick={copyGroup}>
                  <Copy /> Copy
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RemindersView({ canEditAutomation = false }: { canEditAutomation?: boolean }) {
  const canManage = useCanManage();
  const hydrated = useHydrated();
  const templates = useCollection("templates");
  const students = useCollection("students");
  const courses = useCollection("courses");
  const fees = useCollection("fees");
  const profile = useProfile();
  const sector = getSector(profile.businessType);
  const biz = profile.businessName || "our institute";
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "";

  // One-time, safe upgrade: replace any template still on an OLD default wording
  // with its sector's professional version. Never touches templates you've edited.
  const migrated = useRef(false);
  useEffect(() => {
    // Owner-only: templates are not staff-writable, so without this a teacher
    // opening Reminders got a "Forbidden" toast for visiting the page.
    if (!hydrated || migrated.current || !canManage) return;
    migrated.current = true;
    const seedByName = new Map(sector.seedTemplates.map((t) => [t.name, t.body]));
    templates.forEach((t) => {
      const legacies = LEGACY_BODIES[t.name];
      const fresh = seedByName.get(t.name);
      if (legacies && fresh && legacies.includes(t.body) && t.body !== fresh) {
        updateItem<Template>("templates", t.id, { body: fresh });
      }
    });
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const addBtn = (
    <FormDialog
      title="New template" submitLabel="Save template" successMessage="Template saved"
      description="A reusable message. Type variables like {{student_name}}, {{parent_name}} or {{business}} — they auto-fill when you send to a parent; {{date}}, {{amount}} etc. become quick fill-in fields."
      trigger={<Button><Plus /> New template</Button>}
      fields={fields()}
      onSubmit={(v) => addItem<Template>("templates", {
        id: newId("tpl"), name: v("name"), type: "custom", channel: "whatsapp", body: v("body"),
      })}
    />
  );

  // Add missing built-in templates and refresh existing ones to the latest wording.
  function loadDefaults() {
    const byName = new Map(templates.map((t) => [t.name.toLowerCase(), t]));
    let added = 0, refreshed = 0;
    sector.seedTemplates.forEach((t) => {
      const existing = byName.get(t.name.toLowerCase());
      if (existing) {
        if (existing.body !== t.body || existing.type !== t.type) {
          updateItem<Template>("templates", existing.id, { body: t.body, type: t.type });
          refreshed += 1;
        }
      } else {
        addItem<Template>("templates", { id: newId("tpl"), name: t.name, type: t.type, channel: "whatsapp", body: t.body });
        added += 1;
      }
    });
    toast.success("Templates updated", { description: `${added} added, ${refreshed} refreshed` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Reminders"
        description="Send a template to one parent, or post an announcement to your parents' group. Free — messages open in your own WhatsApp, you press send."
        actions={addBtn}
      />

      {hydrated && <AutomationPanel canEdit={canEditAutomation} />}

      {hydrated && <SendPanel students={students} templates={templates} fees={fees} biz={biz} courseName={courseName} />}

      {/* Template library */}
      {!hydrated ? null : templates.length === 0 ? (
        <EmptyState
          icon={MessageSquare} title="No templates yet"
          description={`Add ready-made WhatsApp templates for your ${sector.label}, or create your own.`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadDefaults}><MessageSquare /> Add {sector.label} templates</Button>
              {addBtn}
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Your templates</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <MessageSquare className="size-4" />
                      </span>
                      <h3 className="font-bold">{t.name}</h3>
                    </div>
                    <Badge variant="outline">{t.channel}</Badge>
                  </div>
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t.body}</p>
                  <div className="flex gap-2">
                    <FormDialog
                      title="Edit template" submitLabel="Save changes" successMessage="Template updated"
                      trigger={<Button size="sm" variant="outline" className="flex-1"><Pencil /> Edit</Button>}
                      fields={fields(t)}
                      onSubmit={(v) => updateItem<Template>("templates", t.id, { name: v("name"), body: v("body") })}
                    />
                    <ConfirmDialog
                      title={`Delete "${t.name}"?`} confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("templates", t.id); toast.success("Template deleted"); }}
                      trigger={<Button size="sm" variant="outline" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
