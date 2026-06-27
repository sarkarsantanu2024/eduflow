"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword, type PasswordState } from "@/features/auth/actions";

/** Self-service password change for the signed-in user (any role). */
export function ChangePasswordCard() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeOwnPassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" /> Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid max-w-md gap-4" autoComplete="off">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="off" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="off" required minLength={8} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="off" required minLength={8} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.ok && <p className="text-sm text-emerald-600">Password updated successfully.</p>}
          <div>
            <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
