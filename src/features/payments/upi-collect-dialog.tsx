"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { QrCode, Copy, Check, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  useProfile, updateItem, addItem, newId, type Payment, type Fee,
} from "@/lib/store/local-db";
import { formatCurrency } from "@/lib/utils";

/**
 * Shows the institute's own UPI QR + UPI ID for the parent to pay, then lets
 * the admin record the payment. No gateway needed (UPI-only collection).
 */
export function UpiCollectDialog({
  trigger,
  feeId,
  studentId,
  studentName,
  amount, // rupees
}: {
  trigger: React.ReactNode;
  feeId?: string;
  studentId?: string;
  studentName?: string;
  amount?: number;
}) {
  const profile = useProfile();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  function copyUpi() {
    if (!profile.upiId) return;
    navigator.clipboard.writeText(profile.upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function markPaid() {
    const today = new Date().toISOString().slice(0, 10);
    if (feeId && amount) {
      updateItem<Fee>("fees", feeId, { amountPaid: amount, status: "paid" });
    }
    addItem<Payment>("payments", {
      id: newId("pay"),
      studentId: studentId ?? "",
      studentName: studentName ?? "Walk-in",
      amount: amount ?? 0,
      method: "upi",
      status: "success",
      date: today,
    });
    toast.success("Payment recorded");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect via UPI</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} · ` : ""}
            {amount ? formatCurrency(amount * 100) : "Show this QR to the parent to pay."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="flex size-48 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {profile.qrImage ? (
              <img src={profile.qrImage} alt="UPI QR" className="size-48 object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center text-muted-foreground">
                <QrCode className="size-8" />
                <span className="text-xs">Upload your payment QR in <b>My Profile</b></span>
              </div>
            )}
          </div>

          <div className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2">
            <span className="truncate text-sm font-medium">{profile.upiId || "Set your UPI ID in My Profile"}</span>
            {profile.upiId && (
              <button onClick={copyUpi} className="text-muted-foreground hover:text-foreground" aria-label="Copy UPI ID">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          <Button onClick={markPaid}><IndianRupee /> Mark as paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
