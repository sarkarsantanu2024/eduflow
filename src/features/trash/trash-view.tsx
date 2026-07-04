"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Undo2, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import { restoreItem, permanentlyDelete, type CollectionName } from "@/lib/store/local-db";
import { fetchTrash, type TrashItem } from "@/features/data/actions";
import { formatCurrency, formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  students: "Student", courses: "Level", batches: "Batch", templates: "Template",
  fees: "Fee", payments: "Payment", expenses: "Expense", attendance: "Attendance",
  promotions: "Promotion", testScores: "Test score", certificates: "Certificate",
  examRegs: "Exam reg", performances: "Performance", materials: "Material",
  adMaterials: "Ad material", stationery: "Stationery", events: "Event", teachers: "Teacher",
};

const selectClass =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type SortKey = "recent" | "oldest" | "type" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently deleted" },
  { key: "oldest", label: "Oldest first" },
  { key: "type", label: "Type (A–Z)" },
  { key: "name", label: "Name (A–Z)" },
];

export function TrashView() {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const load = useCallback(async () => {
    try {
      setItems(await fetchTrash());
    } catch {
      setItems([]);
      toast.error("Could not load Trash");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function onRestore(it: TrashItem) {
    setBusy(it.id);
    try {
      await restoreItem(it.collection as CollectionName, it.id);
      toast.success(`Restored ${TYPE_LABEL[it.collection]?.toLowerCase() ?? "item"}`, { description: it.label });
      await load();
    } catch { toast.error("Restore failed"); } finally { setBusy(null); }
  }

  async function onPurge(it: TrashItem) {
    setBusy(it.id);
    try {
      await permanentlyDelete(it.collection as CollectionName, it.id);
      toast.success("Permanently deleted");
      await load();
    } catch { toast.error("Delete failed"); } finally { setBusy(null); }
  }

  // Types present in the trash, for the filter dropdown.
  const typesPresent = useMemo(() => {
    const set = new Map<string, number>();
    (items ?? []).forEach((it) => set.set(it.collection, (set.get(it.collection) ?? 0) + 1));
    return Array.from(set.entries()).sort((a, b) => (TYPE_LABEL[a[0]] ?? a[0]).localeCompare(TYPE_LABEL[b[0]] ?? b[0]));
  }, [items]);

  const view = useMemo(() => {
    let list = items ?? [];
    if (type !== "all") list = list.filter((it) => it.collection === type);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((it) => it.label.toLowerCase().includes(needle) || (TYPE_LABEL[it.collection] ?? "").toLowerCase().includes(needle));
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest": return a.deletedAt.localeCompare(b.deletedAt);
        case "type": return (TYPE_LABEL[a.collection] ?? a.collection).localeCompare(TYPE_LABEL[b.collection] ?? b.collection) || a.label.localeCompare(b.label);
        case "name": return a.label.localeCompare(b.label);
        default: return b.deletedAt.localeCompare(a.deletedAt); // recent
      }
    });
    return sorted;
  }, [items, type, q, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash"
        description="Anything you delete lands here and can be restored. Items stay in Trash until you permanently delete them — nothing is removed automatically."
      />

      {items === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty" description="Deleted items appear here and can be restored anytime." />
      ) : (
        <>
          {/* Filters & sorting */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Trash…" className="pl-9" />
            </div>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types ({items.length})</option>
              {typesPresent.map(([c, n]) => <option key={c} value={c}>{TYPE_LABEL[c] ?? c} ({n})</option>)}
            </select>
            <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className={`text-right ${stickyActionsHead}`}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nothing matches your filters.</TableCell></TableRow>
                )}
                {view.map((it) => (
                  <TableRow key={`${it.collection}_${it.id}`}>
                    <TableCell><Badge variant="outline">{TYPE_LABEL[it.collection] ?? it.collection}</Badge></TableCell>
                    <TableCell className="font-medium">{it.label || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.amount ? formatCurrency(it.amount * 100) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(it.deletedAt.slice(0, 10))}</TableCell>
                    <TableCell className={`text-right ${stickyActionsCell}`}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => onRestore(it)}>
                          <Undo2 className="size-4" /> Restore
                        </Button>
                        <ConfirmDialog
                          title={`Permanently delete "${it.label}"?`}
                          description="This removes it from the database for good. It cannot be recovered."
                          confirmLabel="Delete forever" destructive
                          onConfirm={() => onPurge(it)}
                          trigger={<Button size="icon" variant="ghost" aria-label="Delete permanently" disabled={busy === it.id}><Trash2 className="text-destructive" /></Button>}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
