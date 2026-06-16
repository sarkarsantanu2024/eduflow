"use client";

import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/demo";

/** Client button that shows a themed success toast on click (demo-friendly). */
export function ActionButton({
  children,
  toastMessage,
  toastDescription,
  ...props
}: ButtonProps & { toastMessage: string; toastDescription?: string }) {
  return (
    <Button
      {...props}
      onClick={() =>
        toast.success(toastMessage, {
          description: toastDescription ?? (DEMO_MODE ? "Demo mode — not persisted." : undefined),
        })
      }
    >
      {children}
    </Button>
  );
}
