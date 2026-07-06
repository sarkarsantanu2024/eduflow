"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpOrganization, type AuthState } from "@/features/auth/actions";

/** Self-serve signup for a franchise / multi-center brand (Head Office). */
export function OrgRegisterForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUpOrganization, undefined);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" /></span>
          <h2 className="text-2xl font-bold">Register your brand</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          For franchises running multiple branches. You&apos;ll get a Head-Office login, then
          create each franchise center yourself. Start free — no card required.
        </p>
      </div>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="organizationName">Brand / organization name</Label>
          <Input id="organizationName" name="organizationName" required placeholder="e.g. Mind Mantra Abacus (Head Office)" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Your name</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" autoComplete="username" required placeholder="your-username" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="owner@brand.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        </div>

        {state?.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}

        <Button type="submit" className="w-full sm:col-span-2" disabled={pending}>
          {pending ? "Creating brand…" : "Create brand account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Running a single center?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">Register a center instead</Link>
        {" · "}
        <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
