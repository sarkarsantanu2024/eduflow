import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** PrintReady-style brand mark: orange rounded square + two-tone wordmark. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="size-5" />
      </span>
      {showText && (
        <span className="text-xl font-extrabold tracking-tight text-foreground">
          Edu<span className="text-primary">Flow</span>
        </span>
      )}
    </div>
  );
}
