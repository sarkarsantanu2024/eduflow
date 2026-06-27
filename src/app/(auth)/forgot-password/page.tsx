import Link from "next/link";
import { SUPPORT } from "@/lib/constants";

/**
 * Password resets are handled by an admin (not self-service email), so this
 * page explains how to get a reset rather than pretending to send a link.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Forgot your password?</h2>
        <p className="text-sm text-muted-foreground">Here&apos;s how to get back in.</p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="rounded-xl border bg-card p-4">
          <p className="font-semibold">Center staff</p>
          <p className="text-muted-foreground">Ask your center owner — they can reset your password from the Teachers screen.</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="font-semibold">Center owner</p>
          <p className="text-muted-foreground">
            Contact {SUPPORT.productName} support to reset your password:
            <br />
            <span className="text-foreground">{SUPPORT.ownerName} · {SUPPORT.phone}</span>
            <br />
            <span className="text-foreground">{SUPPORT.email}</span>
          </p>
        </div>
        <p className="text-muted-foreground">
          Tip: once you&apos;re signed in, you can change your password anytime from your <strong>Profile</strong>.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
