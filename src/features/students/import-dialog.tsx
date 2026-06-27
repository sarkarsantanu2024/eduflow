"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STUDENT_IMPORT_FIELDS, autoDetectMapping, buildStudents, type ImportedStudent } from "@/features/students/student-csv";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Lets the owner confirm/adjust how each spreadsheet column maps to a student
 * field before importing — so any header works, not just recognised ones.
 */
export function ImportColumnsDialog({
  headers,
  rows,
  onCancel,
  onConfirm,
}: {
  headers: string[];
  rows: Record<string, unknown>[];
  onCancel: () => void;
  onConfirm: (records: ImportedStudent[]) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => autoDetectMapping(headers));

  const sample = (header: string) => {
    const v = rows.find((r) => String(r[header] ?? "").trim())?.[header];
    return v == null || v === "" ? "—" : String(v);
  };
  const willImport = buildStudents(rows, mapping).length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map your columns</DialogTitle>
          <DialogDescription>
            We matched what we could. Adjust any column below, then import. Unmapped columns are skipped;
            missing details can be filled in later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.2fr] gap-3 border-b pb-1.5 text-xs font-semibold text-muted-foreground">
            <span>Your column (sample)</span>
            <span>Import as</span>
          </div>
          {headers.map((h) => (
            <div key={h} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={h}>{h}</p>
                <p className="truncate text-xs text-muted-foreground" title={sample(h)}>e.g. {sample(h)}</p>
              </div>
              <select
                className={selectClass}
                value={mapping[h] ?? "ignore"}
                onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
              >
                {STUDENT_IMPORT_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">{willImport} student{willImport === 1 ? "" : "s"} ready</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={willImport === 0} onClick={() => onConfirm(buildStudents(rows, mapping))}>
              Import {willImport}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
