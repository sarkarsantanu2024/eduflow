"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { formatCurrency } from "@/lib/utils";

/** Real, scannable UPI intent QR (renders the amount + payee) via a free QR service. */
export function upiQrUrl(
  upiId: string,
  payeeName: string,
  amount: number,
  note: string,
) {
  const upi =
    `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}` +
    `&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upi)}`;
}

/**
 * Previews a WhatsApp message (and a UPI QR when there's an amount to pay).
 *
 * Two clearly-separated confirmations:
 *  • `onSent`  — the message was sent via WhatsApp (e.g. stamp "reminder sent").
 *                Sending is the ONLY thing that records this, so there's no
 *                redundant "Mark as sent" button.
 *  • `action`  — an optional NON-WhatsApp state change (e.g. "Mark as paid" for
 *                an offline cash/UPI payment). Kept separate so sending a message
 *                never accidentally records a payment.
 *
 * Demo mode: WhatsApp opens via a wa.me link; swap in the Cloud API later.
 */
export function WaQrDialog({
  trigger,
  title,
  recipientName,
  mobile,
  message,
  amount = 0,
  upiId,
  qrImage,
  payeeName = "Institute",
  note = "",
  onSent,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  recipientName: string;
  mobile: string;
  message: string;
  amount?: number; // rupees; > 0 shows a payment QR
  upiId?: string;
  qrImage?: string; // uploaded PhonePe/GPay/Paytm QR — preferred when set
  payeeName?: string;
  note?: string;
  onSent?: () => void; // fired when the message is sent on WhatsApp
  action?: { label: string; icon?: React.ReactNode; onClick: () => void }; // optional offline action
}) {
  const [open, setOpen] = useState(false);
  // Prefer the center's uploaded QR; otherwise build a UPI-intent QR from the UPI ID.
  const qrSrc =
    qrImage || (upiId ? upiQrUrl(upiId, payeeName, amount, note) : "");
  const showQr = amount > 0 && !!qrSrc;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            To {recipientName} · WhatsApp {mobile}
          </DialogDescription>
        </DialogHeader>

        {/* WhatsApp-style message bubble */}
        <div className="rounded-xl rounded-tl-sm bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
          {message}
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={qrSrc}
              alt="Payment QR code"
              className="size-44 rounded-lg border bg-white object-contain"
            />
            <p className="text-xs text-muted-foreground">
              Scan to pay{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(amount * 100)}
              </span>
              {upiId && <> · {upiId}</>}
            </p>
            <a
              href={qrSrc}
              download="payment-qr.png"
              className="text-xs font-medium text-primary hover:underline"
            >
              Save QR image to attach in WhatsApp
            </a>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {action && (
            <Button
              variant="outline"
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
            >
              {action.icon} {action.label}
            </Button>
          )}
          <SendOnWhatsApp
            phone={mobile}
            message={message}
            onSent={() => {
              onSent?.();
              setOpen(false);
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
