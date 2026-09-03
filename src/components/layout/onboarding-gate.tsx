"use client";

import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

/**
 * Shown when a new centre tries to open a module before finishing setup.
 *
 * The gate itself is a redirect back to /profile. On its own that reads as a
 * broken app — the page just snaps back with no explanation — so this says why,
 * in a modal the owner can read and dismiss rather than a toast that lands on
 * top of the header buttons and disappears on its own.
 */
export function OnboardingGateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Rocket className="size-5" />
          </span>
          <DialogTitle>Finish setting up your centre</DialogTitle>
          <DialogDescription>
            We just need your centre&apos;s basic details before you can start adding students.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2.5 text-sm">
          {[
            "Check your business name, type and monthly fee below.",
            "Add your address and contact number.",
            "Tap Save changes at the bottom of the page.",
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Every menu unlocks the moment you save — this is a one-time step.
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button className="w-full sm:w-auto">Got it — let&apos;s set it up</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
