"use client";

import { MessageSquare, Plus, Pencil, Trash2, Send, CalendarClock, Sparkles } from "lucide-react";
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
