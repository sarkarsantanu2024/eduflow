"use client";

import { CreditCard, QrCode, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { UpiCollectDialog } from "@/features/payments/upi-collect-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { useCollection, useHydrated, loadSamples, type Payment } from "@/lib/store/local-db";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<Payment["status"], "success" | "warning"> = {
  success: "success", pending: "warning",
};

export function PaymentsView() {
  const hydrated = useHydrated();
  const payments = useCollection("payments");

  const collectBtn = (
    <UpiCollectDialog trigger={<Button><QrCode /> Collect via UPI</Button>} />
  );

  if (hydrated && payments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" description="Money received. Collect via your UPI QR." actions={collectBtn} />
        <EmptyState
          icon={CreditCard} title="No payments yet"
          description="Collect a payment via UPI, or load sample data. Payments you record from Fees appear here."
          action={
            <div className="flex gap-2">
              {collectBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Money received. Collect via your UPI QR." actions={collectBtn} />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead><TableHead>Amount</TableHead>
              <TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.studentName}</TableCell>
                <TableCell>{formatCurrency(p.amount * 100)}</TableCell>
                <TableCell className="uppercase">{p.method}</TableCell>
                <TableCell>{p.date ? formatDate(p.date) : "—"}</TableCell>
                <TableCell><Badge variant={statusVariant[p.status]}>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
