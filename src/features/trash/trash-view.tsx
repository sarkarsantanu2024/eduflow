"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import { restoreItem, permanentlyDelete, type CollectionName } from "@/lib/store/local-db";
import { fetchTrash, type TrashItem } from "@/features/data/actions";
import { formatCurrency } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  students: "Student", fees: "Fee", payments: "Payment", expenses: "Expense", materials: "Material",
};

const TTL_DAYS = 30;

function daysLeft(deletedAt: string): number {
  const gone = (Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TTL_DAYS - gone));
}

export function TrashView() {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
    } catch {
      toast.error("Restore failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPurge(it: TrashItem) {
    setBusy(it.id);
    try {
      await permanentlyDelete(it.collection as CollectionName, it.id);
      toast.success("Permanently deleted");
      await load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash"
        description={`Deleted students, fees, payments, expenses and materials. Restore them, or delete permanently. Items are removed automatically ${TTL_DAYS} days after deletion.`}
      />

      {items === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="Trash is empty" description="Deleted items appear here and can be restored within 30 days." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Amount</TableHead>
                <TableHead>Auto-deletes</TableHead><TableHead className={`text-right ${stickyActionsHead}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.collection}_${it.id}`}>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[it.collection] ?? it.collection}</Badge></TableCell>
                  <TableCell className="font-medium">{it.label || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{it.amount ? formatCurrency(it.amount * 100) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">in {daysLeft(it.deletedAt)} day{daysLeft(it.deletedAt) === 1 ? "" : "s"}</TableCell>
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
      )}
    </div>
  );
}
