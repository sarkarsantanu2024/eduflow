"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type AuthState } from "@/features/auth/actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    async (prev, fd) => {
      const res = await requestPasswordReset(prev, fd);
      return res ?? { error: "" }; // empty error → treated as success below
    },
    undefined
  );

  const sent = state !== undefined && !state.error;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Reset password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
