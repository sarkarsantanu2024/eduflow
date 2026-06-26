"use client";

import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { waLink } from "@/lib/wa-link";

/**
 * A button that opens WhatsApp with a pre-filled message (free click-to-send).
 * `onSent` fires when tapped, so callers can stamp "reminder sent" state.
 */
export function SendOnWhatsApp({
  phone,
  message,
  label = "Send on WhatsApp",
  onSent,
  size,
  variant = "default",
  className,
}: {
  phone: string;
  message: string;
  label?: string;
  onSent?: () => void;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a
        href={waLink(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onSent?.()}
      >
        <MessageCircle /> {label}
      </a>
    </Button>
  );
}
