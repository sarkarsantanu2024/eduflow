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

/** Short weekday labels, in the order a timetable is read. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "16:00" → "4:00 PM". Empty in, empty out. */
function to12Hour(hhmm: string): string {
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h)) return "";
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(Number.isFinite(m) ? m : 0).padStart(2, "0")} ${suffix}`;
}

/** Two clock values → the single string stored on the batch. */
function joinTimeRange(from: string, to: string): string {
  const a = to12Hour(from);
  const b = to12Hour(to);
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

/**
 * Read an existing timing back into two 24-hour values for the clock inputs.
 * Batches created before this control hold free text in every imaginable
 * shape ("4p.m. - 6p.m.", "5:00 PM - 6:30 PM", "16:00-18:00"), so parse
 * loosely and fall back to blank rather than showing something wrong.
 */
export function splitTimeRange(value?: string): { from: string; to: string } {
  const found: string[] = [];
  if (value) {
    const twelve = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/gi;
    let m: RegExpExecArray | null;
    while (found.length < 2 && (m = twelve.exec(value)) !== null) {
      const base = Number(m[1] ?? 0) % 12;
      const hour = (m[3] ?? "").toLowerCase() === "p" ? base + 12 : base;
      found.push(`${String(hour).padStart(2, "0")}:${m[2] ?? "00"}`);
    }
    if (found.length === 0) {
      const twentyFour = /(\d{1,2}):(\d{2})/g;
      let n: RegExpExecArray | null;
      while (found.length < 2 && (n = twentyFour.exec(value)) !== null) {
        found.push(`${(n[1] ?? "0").padStart(2, "0")}:${n[2] ?? "00"}`);
      }
    }
  }
  return { from: found[0] ?? "", to: found[1] ?? "" };
}

/** "Saturday, Mon" → ["Mon","Sat"]. Matches on the first three letters. */
export function splitDays(value?: string): string[] {
  if (!value) return [];
  const parts = value.split(/[,/|+&]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return WEEKDAYS.filter((d) => parts.some((p) => p.startsWith(d.toLowerCase())));
}

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
