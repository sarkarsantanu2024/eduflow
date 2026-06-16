"use client";

import { MessageSquare, Plus, Pencil, Trash2, Send, CalendarClock, Sparkles, Cake, Palmtree, DoorClosed } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useCollection, useHydrated, addItem, updateItem, removeItem, loadSamples, newId, type Template,
} from "@/lib/store/local-db";

const TYPE_OPTIONS = [
  { value: "fee_due", label: "Fee due" },
  { value: "fee_overdue", label: "Fee overdue" },
  { value: "birthday", label: "Birthday" },
  { value: "holiday_notice", label: "Holiday notice" },
  { value: "custom", label: "Custom" },
];

function fields(t?: Template): FormField[] {
  return [
    { name: "name", label: "Template name", required: true, defaultValue: t?.name },
    { name: "type", label: "Type", type: "select", options: TYPE_OPTIONS, defaultValue: t?.type ?? "fee_due" },
    { name: "body", label: "Message", type: "textarea", required: true, defaultValue: t?.body,
      placeholder: "Hi {{parent_name}}, ₹{{amount}} for {{student_name}} is due on {{due_date}}." },
  ];
}

function Schedule() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" /> Automatic fee-reminder schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">For every student with an unpaid fee, EduFlow sends WhatsApp reminders automatically:</p>
        <ul className="space-y-2">
          {["Runs on the 1st–10th of every month",
            "Up to 5 reminders per student, one per day (1-day gap)",
            "Stops early as soon as the fee is paid",
            "Sends the message you choose from your templates below"].map((l) => (
            <li key={l} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" /><span>{l}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** One-tap WhatsApp broadcasts: birthdays, holidays and same-day closures. */
function Broadcasts() {
  const students = useCollection("students");
  const todayMd = new Date().toISOString().slice(5, 10); // MM-DD
  const birthdays = students.filter((s) => s.dob && s.dob.slice(5) === todayMd);
  const count = students.length;
  const tile = "flex flex-col gap-2 rounded-xl border bg-card p-4";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5 text-primary" /> Quick broadcasts
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {/* Birthdays */}
        <div className={tile}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Cake className="size-4" /></span>
          <h4 className="font-semibold">Birthday wishes</h4>
          <p className="flex-1 text-sm text-muted-foreground">
            {birthdays.length
              ? `${birthdays.map((s) => s.firstName).join(", ")} — birthday today 🎂`
              : "No birthdays today."}
          </p>
          <Button size="sm" className="w-full" disabled={!birthdays.length}
            onClick={() => toast.success(`Birthday wishes sent to ${birthdays.length} parent${birthdays.length > 1 ? "s" : ""}`, { description: "Demo — preview only" })}>
            <Cake /> Send wishes
          </Button>
        </div>

        {/* Holiday notice */}
        <div className={tile}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Palmtree className="size-4" /></span>
          <h4 className="font-semibold">Holiday notice</h4>
          <p className="flex-1 text-sm text-muted-foreground">Announce a holiday to all {count} parents.</p>
          <FormDialog
            title="Holiday notice" submitLabel="Send to all parents"
            successMessage={`Holiday notice sent to ${count} parents on WhatsApp`}
            description="Sent over WhatsApp to every parent."
            trigger={<Button size="sm" variant="outline" className="w-full"><Palmtree /> New notice</Button>}
            fields={[
              { name: "date", label: "Date", type: "date", required: true },
              { name: "occasion", label: "Occasion", required: true, placeholder: "Durga Puja" },
            ]}
            onSubmit={() => {}}
          />
        </div>

        {/* Class closed today */}
        <div className={tile}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"><DoorClosed className="size-4" /></span>
          <h4 className="font-semibold">Class closed today</h4>
          <p className="flex-1 text-sm text-muted-foreground">Cancel today&apos;s class for all {count} parents.</p>
          <FormDialog
            title="Class closed today" submitLabel="Send to all parents"
            successMessage={`Closure notice sent to ${count} parents on WhatsApp`}
            description="Sent over WhatsApp to every parent."
            trigger={<Button size="sm" variant="outline" className="w-full"><DoorClosed /> Announce closure</Button>}
            fields={[{ name: "reason", label: "Reason", required: true, placeholder: "Heavy rain / teacher unavailable" }]}
            onSubmit={() => {}}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function RemindersView() {
  const hydrated = useHydrated();
  const templates = useCollection("templates");

  const addBtn = (
    <FormDialog
      title="New template" submitLabel="Save template" successMessage="Template saved"
      description="Use {{student_name}}, {{amount}}, {{due_date}} variables."
      trigger={<Button><Plus /> New template</Button>}
      fields={fields()}
      onSubmit={(v) => addItem<Template>("templates", {
        id: newId("tpl"), name: v("name"), type: v("type"), channel: "whatsapp", body: v("body"),
      })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Reminders" description="Automate fee reminders and notices over WhatsApp." actions={addBtn} />
      <Broadcasts />
      <Schedule />

      {!hydrated ? null : templates.length === 0 ? (
        <EmptyState
          icon={MessageSquare} title="No templates yet"
          description="Create reusable WhatsApp templates, or load sample data."
          action={
            <div className="flex gap-2">
              {addBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      ) : (
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
                    onSubmit={(v) => updateItem<Template>("templates", t.id, { name: v("name"), type: v("type"), body: v("body") })}
                  />
                  <ConfirmDialog
                    title={`Delete "${t.name}"?`} confirmLabel="Delete" destructive
                    onConfirm={() => { removeItem("templates", t.id); toast.success("Template deleted"); }}
                    trigger={<Button size="sm" variant="outline" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                  />
                  <Button size="sm" variant="outline" aria-label="Send test"
                    onClick={() => toast.success("Test message sent", { description: "Connect WhatsApp Cloud API to send for real." })}>
                    <Send />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
