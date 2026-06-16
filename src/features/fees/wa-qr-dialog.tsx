"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

/** Real, scannable UPI intent QR (renders the amount + payee) via a free QR service. */
export function upiQrUrl(upiId: string, payeeName: string, amount: number, note: string) {
  const upi =
    `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}` +
    `&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upi)}`;
}

/**
 * Previews a WhatsApp message (and a UPI QR when there's an amount to pay) and
 * runs an action on confirm. Demo mode: nothing is actually sent — this is the
 * preview + "mark as …" step. Swap in the WhatsApp Cloud API later.
 */
export function WaQrDialog({
  trigger, title, recipientName, mobile, message,
  amount = 0, upiId, payeeName = "Institute", note = "",
  actionLabel, actionIcon, onAction,
}: {
  trigger: React.ReactNode;
  title: string;
  recipientName: string;
  mobile: string;
  message: string;
  amount?: number; // rupees; > 0 shows a UPI QR
  upiId?: string;
  payeeName?: string;
  note?: string;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  onAction: () => void;
}) {
  const [open, setOpen] = useState(false);
  const showQr = amount > 0 && !!upiId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>To {recipientName} · WhatsApp {mobile}</DialogDescription>
        </DialogHeader>

        {/* WhatsApp-style message bubble */}
        <div className="rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
          {message}
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={upiQrUrl(upiId!, payeeName, amount, note)}
              alt="UPI QR code"
              className="size-44 rounded-lg border bg-white object-contain"
            />
            <p className="text-xs text-muted-foreground">
              Scan to pay <span className="font-semibold text-foreground">{formatCurrency(amount * 100)}</span> · {upiId}
            </p>
          </div>
        )}

        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Demo mode — previewed, not actually sent. Connect the WhatsApp Cloud API to deliver for real.
        </p>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          <Button onClick={() => { onAction(); setOpen(false); }}>
            {actionIcon} {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
