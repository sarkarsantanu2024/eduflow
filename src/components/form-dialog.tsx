"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { DEMO_MODE } from "@/lib/demo";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}

const controlClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Generic "create / edit" dialog. In demo mode it validates required fields,
 * shows a themed success toast and closes (non-persistent). In live mode,
 * pass an `onSubmit` that writes to Supabase.
 */
export function FormDialog({
  trigger,
  title,
  description,
  fields,
  submitLabel = "Save",
  successMessage,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  successMessage?: string;
  /** When provided, receives a value getter and persists them. */
  onSubmit?: (get: (name: string) => string) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const f of fields) {
      const value = String(data.get(f.name) ?? "").trim();
      if (f.required && !value) {
        toast.error(`${f.label} is required`);
        return;
      }
      values[f.name] = value;
    }
    setOpen(false);
    onSubmit?.((name: string) => values[name] ?? "");
    toast.success(successMessage ?? `${title} saved`, {
      description: onSubmit ? undefined : DEMO_MODE ? "Demo mode — not persisted." : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div
                key={f.name}
                className={cnFull(f.type)}
              >
                <Label className="mb-1.5 block">{f.label}</Label>
                {f.type === "textarea" ? (
                  <textarea name={f.name} placeholder={f.placeholder} defaultValue={f.defaultValue} className={`${controlClass} min-h-24 py-2`} />
                ) : f.type === "select" ? (
                  <select name={f.name} className={controlClass} defaultValue={f.defaultValue ?? ""}>
                    <option value="" disabled>Select…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} defaultValue={f.defaultValue} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function cnFull(type?: FormField["type"]) {
  return type === "textarea" ? "sm:col-span-2" : "";
}
