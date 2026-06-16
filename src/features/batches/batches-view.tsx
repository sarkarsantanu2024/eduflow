"use client";

import { CalendarClock, Plus, Pencil, Trash2, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, removeItem, loadSamples, newId, type Batch,
} from "@/lib/store/local-db";
import { getLabels } from "@/lib/constants";

function fields(b?: Batch): FormField[] {
  return [
    { name: "name", label: "Batch name", required: true, defaultValue: b?.name },
    { name: "timing", label: "Timing", placeholder: "5:00 PM - 6:30 PM", defaultValue: b?.timing },
    { name: "days", label: "Days", placeholder: "Mon, Wed, Fri", defaultValue: b?.days },
    { name: "capacity", label: "Capacity", type: "number", defaultValue: b?.capacity },
  ];
}

export function BatchesView() {
  const hydrated = useHydrated();
  const batches = useCollection("batches");
  const { batches: label } = getLabels(useProfile().businessType);

  const addBtn = (
    <FormDialog
      title="Add batch" submitLabel="Add batch" successMessage="Batch added"
      trigger={<Button><Plus /> Add batch</Button>}
      fields={fields()}
      onSubmit={(v) => addItem<Batch>("batches", {
        id: newId("batch"), name: v("name"), timing: v("timing"), days: v("days"), capacity: v("capacity"), courseId: "",
      })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title={label} description={`Schedule ${label.toLowerCase()} with timings and days.`} actions={addBtn} />

      {!hydrated ? null : batches.length === 0 ? (
        <EmptyState
          icon={CalendarClock} title="No batches yet"
          description="Create batches to group students by schedule."
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="flex gap-1">
                    <FormDialog
                      title="Edit batch" submitLabel="Save" successMessage="Batch updated"
                      trigger={<Button size="icon" variant="ghost" aria-label="Edit"><Pencil /></Button>}
                      fields={fields(b)}
                      onSubmit={(v) => updateItem<Batch>("batches", b.id, {
                        name: v("name"), timing: v("timing"), days: v("days"), capacity: v("capacity"),
                      })}
                    />
                    <ConfirmDialog
                      title={`Delete "${b.name}"?`} confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("batches", b.id); toast.success("Batch deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </div>
                </div>
                <h3 className="font-bold">{b.name}</h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-4" /> {b.timing || "—"}
                </div>
                {b.days && (
                  <div className="flex flex-wrap gap-1.5 border-t pt-3">
                    {b.days.split(",").map((d) => d.trim()).filter(Boolean).map((d) => (
                      <span key={d} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">{d}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
