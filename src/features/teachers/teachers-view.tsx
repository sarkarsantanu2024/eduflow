"use client";

import { GraduationCap, Plus, Pencil, Trash2, Star, Phone } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useCollection, useHydrated, addItem, updateItem, removeItem, newId, type Teacher,
} from "@/lib/store/local-db";
import { formatCurrency } from "@/lib/utils";

function fields(t?: Teacher): FormField[] {
  return [
    { name: "name", label: "Full name", required: true, defaultValue: t?.name },
    { name: "phone", label: "Phone", placeholder: "+9198…", defaultValue: t?.phone },
    { name: "email", label: "Email", type: "email", defaultValue: t?.email },
    { name: "specialization", label: "Specialization", placeholder: "Subject / dance form / software", defaultValue: t?.specialization },
    { name: "salary", label: "Monthly salary (₹)", type: "number", defaultValue: t?.salary ? String(t.salary) : "" },
    { name: "joinDate", label: "Joining date", type: "date", defaultValue: t?.joinDate },
  ];
}

export function TeachersView() {
  const hydrated = useHydrated();
  const teachers = useCollection("teachers");
  const batches = useCollection("batches");

  const addBtn = (
    <FormDialog
      title="Add teacher" submitLabel="Add teacher" successMessage="Teacher added"
      description="Add a staff member, then assign batches and rate them from their card."
      trigger={<Button><Plus /> Add teacher</Button>}
      fields={fields()}
      onSubmit={(v) => addItem<Teacher>("teachers", {
        id: newId("tch"), name: v("name"), phone: v("phone"), email: v("email"),
        specialization: v("specialization"), salary: Number(v("salary")) || 0,
        joinDate: v("joinDate"), batchIds: [], rating: 0, note: "",
      })}
    />
  );

  function toggleBatch(t: Teacher, batchId: string) {
    const has = t.batchIds.includes(batchId);
    updateItem<Teacher>("teachers", t.id, {
      batchIds: has ? t.batchIds.filter((b) => b !== batchId) : [...t.batchIds, batchId],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Teachers & Staff" description="Add staff, assign batches, and rate your teachers." actions={addBtn} />

      {!hydrated ? null : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap} title="No teachers yet"
          description="Add your teaching staff and assign them to batches."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                      {t.name?.[0] ?? "T"}
                    </span>
                    <div>
                      <h3 className="font-bold leading-tight">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.specialization || "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <FormDialog
                      title="Edit teacher" submitLabel="Save" successMessage="Teacher updated"
                      trigger={<Button size="icon" variant="ghost" aria-label="Edit"><Pencil /></Button>}
                      fields={fields(t)}
                      onSubmit={(v) => updateItem<Teacher>("teachers", t.id, {
                        name: v("name"), phone: v("phone"), email: v("email"),
                        specialization: v("specialization"), salary: Number(v("salary")) || 0, joinDate: v("joinDate"),
                      })}
                    />
                    <ConfirmDialog
                      title={`Delete "${t.name}"?`} confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("teachers", t.id); toast.success("Teacher deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={`Rate ${n}`} onClick={() => updateItem<Teacher>("teachers", t.id, { rating: n })}>
                      <Star className={`size-5 ${n <= t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                  {t.salary > 0 && <span className="ml-auto text-xs text-muted-foreground">{formatCurrency(t.salary * 100)}/mo</span>}
                </div>

                {t.phone && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="size-3.5" /> {t.phone}</p>
                )}

                {/* Batch assignment */}
                <div className="border-t pt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assigned batches</p>
                  {batches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No batches yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {batches.map((b) => {
                        const on = t.batchIds.includes(b.id);
                        return (
                          <button key={b.id} type="button" onClick={() => toggleBatch(t, b.id)}>
                            <Badge variant={on ? "default" : "outline"} className="cursor-pointer">{b.name}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
