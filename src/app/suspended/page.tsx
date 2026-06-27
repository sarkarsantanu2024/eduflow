import { AlertTriangle } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { signOut } from "@/features/auth/actions";
import { SUPPORT } from "@/lib/constants";
import { Button } from "@/components/ui/button";

/** Shown when a center is suspended (e.g. for non-payment). */
export default async function SuspendedPage() {
  await requireProfile(); // must be logged in to land here

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="text-sm text-muted-foreground">
            Your center&apos;s access has been temporarily suspended. This usually happens when a
            subscription payment is pending. Please clear your dues to restore access.
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4 text-sm">
          <p className="font-medium">Contact {SUPPORT.productName} support</p>
          <p className="text-muted-foreground">{SUPPORT.ownerName} · {SUPPORT.phone}</p>
          <p className="text-muted-foreground">{SUPPORT.email}</p>
        </div>
        <form action={signOut}>
          <Button variant="outline" className="w-full" type="submit">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
