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
import { WEEKDAYS, joinTimeRange, splitTimeRange, splitDays } from "@/lib/schedule";

export interface FormField {
  name: string;
  label: string;
  /**
   * `timerange` renders two clock inputs and stores one string ("4:00 PM – 6:00 PM").
   * `days` renders weekday chips and stores "Mon, Wed, Fri". Both replaced free
   * text boxes where every owner typed a different format.
   */
  type?: "text" | "number" | "email" | "date" | "textarea" | "select" | "timerange" | "days";
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
 * pass an `onSubmit` that persists the record.
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
      // Composite controls write several form entries; collapse each back into
      // the single string the record actually stores.
      let value: string;
      if (f.type === "timerange") {
        value = joinTimeRange(
          String(data.get(`${f.name}__from`) ?? ""),
          String(data.get(`${f.name}__to`) ?? ""),
        );
      } else if (f.type === "days") {
        value = data.getAll(f.name).map(String).join(", ");
      } else {
        value = String(data.get(f.name) ?? "").trim();
      }

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
                {f.type === "timerange" ? (
                  <TimeRangeField name={f.name} defaultValue={f.defaultValue} />
                ) : f.type === "days" ? (
                  <DaysField name={f.name} defaultValue={f.defaultValue} />
                ) : f.type === "textarea" ? (
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
  // Seven day chips and a start/end pair both need the full row to breathe.
  return type === "textarea" || type === "days" || type === "timerange" ? "sm:col-span-2" : "";
}

/** Start and end clocks. The browser's own time picker, so no typing at all. */
function TimeRangeField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const { from, to } = splitTimeRange(defaultValue);
  return (
    <div className="flex items-center gap-2">
      <input
        type="time" name={`${name}__from`} defaultValue={from}
        aria-label="Start time" className={controlClass}
      />
      <span aria-hidden="true" className="shrink-0 text-sm text-muted-foreground">to</span>
      <input
        type="time" name={`${name}__to`} defaultValue={to}
        aria-label="End time" className={controlClass}
      />
    </div>
  );
}

/** Weekday chips. Multi-select, because most batches run on several days. */
function DaysField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const selected = splitDays(defaultValue);
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((d) => (
        <label key={d} className="cursor-pointer">
          <input
            type="checkbox" name={name} value={d}
            defaultChecked={selected.includes(d)}
            className="peer sr-only"
          />
          <span
            className="inline-flex select-none items-center rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold shadow-sm transition
                       peer-hover:border-primary/50
                       peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground
                       peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30"
          >
            {d}
          </span>
        </label>
      ))}
    </div>
  );
}
