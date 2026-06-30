"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_TYPES } from "@/lib/constants";
import { signUp, type AuthState } from "@/features/auth/actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUp, undefined);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Create your institute</h2>
        <p className="text-sm text-muted-foreground">Start your 14-day free trial. No card required.</p>
      </div>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="instituteName">Center name</Label>
          <Input id="instituteName" name="instituteName" required placeholder="e.g. Bright Abacus Academy" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Center type</Label>
          <select
            id="type" name="type" required defaultValue=""
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="" disabled>Select your center type…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">Address <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <textarea
            id="address" name="address" rows={2} autoComplete="street-address"
            placeholder="Street, area, city, pincode"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
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
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
