"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toCsv, downloadFile } from "@/lib/csv";
import { todayIso } from "@/lib/date";

export type ExportColumn<T> = { header: string; value: (row: T) => string | number };

const stamp = () => todayIso();
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build an Excel-openable HTML table (.xls) — no dependency. */
function toXls(headers: string[], rows: (string | number)[][]): string {
  const th = `<tr>${headers.map((h) => `<th style="background:#eef2ff;border:1px solid #ccc;font-weight:bold;padding:4px">${esc(h)}</th>`).join("")}</tr>`;
  const tb = rows.map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #ddd;padding:4px" ${typeof c === "number" ? 'x:num' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${th}${tb}</table></body></html>`;
}

/**
 * A "Download" menu for any table: exports the given rows as CSV or Excel using
 * the visible columns. Drop it into a PageHeader's actions.
 */
export function ExportData<T>({ filename, rows, columns, disabled }: {
  filename: string;
  rows: T[];
  columns: ExportColumn<T>[];
  disabled?: boolean;
}) {
  const headers = columns.map((c) => c.header);
  const matrix = () => rows.map((r) => columns.map((c) => c.value(r)));
  const empty = rows.length === 0;

  function csv() {
    if (empty) return toast.info("Nothing to export");
    downloadFile(`${filename}-${stamp()}.csv`, toCsv([headers, ...matrix()]));
  }
  function xls() {
    if (empty) return toast.info("Nothing to export");
    downloadFile(`${filename}-${stamp()}.xls`, toXls(headers, matrix()), "application/vnd.ms-excel");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download /> Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Export {rows.length} row{rows.length === 1 ? "" : "s"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={csv}><FileText /> CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onClick={xls}><FileSpreadsheet /> Excel (.xls)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
