"use client";

import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog, type FormField } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, removeItem, newId, type Course,
} from "@/lib/store/local-db";
import { getLabels } from "@/lib/constants";

function fields(c?: Course): FormField[] {
  return [
    { name: "name", label: "Course / level name", required: true, defaultValue: c?.name },
    { name: "description", label: "Description", type: "textarea", defaultValue: c?.description },
  ];
}

export function CoursesView() {
  const hydrated = useHydrated();
  const courses = useCollection("courses");
  const { courses: label } = getLabels(useProfile().businessType);

  const addBtn = (
    <FormDialog
      title="Add course" submitLabel="Add course" successMessage="Course added"
      trigger={<Button><Plus /> Add course</Button>}
      fields={fields()}
      onSubmit={(v) => addItem<Course>("courses", {
        id: newId("course"), name: v("name"), description: v("description"),
      })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title={label} description={`Define the ${label.toLowerCase()} you offer.`} actions={addBtn} />

      {!hydrated ? null : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen} title="No courses yet"
          description="Add a course, or load sample data (the full Abacus level set)."
          action={
            <div className="flex gap-2">
              {addBtn}
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="flex gap-1">
                    <FormDialog
                      title="Edit course" submitLabel="Save" successMessage="Course updated"
                      trigger={<Button size="icon" variant="ghost" aria-label="Edit"><Pencil /></Button>}
                      fields={fields(c)}
                      onSubmit={(v) => updateItem<Course>("courses", c.id, {
                        name: v("name"), description: v("description"),
                      })}
                    />
                    <ConfirmDialog
                      title={`Delete "${c.name}"?`} confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("courses", c.id); toast.success("Course deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold">{c.name}</h3>
                  <p className="text-sm text-muted-foreground">{c.description || "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
