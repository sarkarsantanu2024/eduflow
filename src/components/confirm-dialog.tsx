"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

/**
 * Themed replacement for window.confirm(). Wraps any trigger element and
 * asks for confirmation before running `onConfirm`.
 */
export function ConfirmDialog({
  trigger,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmText,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact text to enable the confirm button. */
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const locked = confirmText !== undefined && typed.trim() !== confirmText;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTyped(""); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {confirmText !== undefined && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-text">
              Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm
            </Label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>{cancelLabel}</Button>
          </DialogClose>
          <Button
            variant={(destructive ? "destructive" : "default") as ButtonProps["variant"]}
            onClick={handleConfirm}
            disabled={busy || locked}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
