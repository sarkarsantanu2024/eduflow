"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";
import { signIn, type AuthState } from "@/features/auth/actions";

export function LoginForm() {
  return (
    <div className="space-y-6">
      {/* Brand mark — visible on mobile where the side panel is hidden */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <span className="text-xl font-extrabold tracking-tight">{APP_NAME}</span>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to your {APP_NAME} account.</p>
      </div>

      <PasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        New to {APP_NAME}?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function PasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4" autoComplete="off">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="input-icon" />
          <Input
            id="email" name="email" type="email" autoComplete="off" required
            placeholder="you@institute.com" className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="input-icon" />
          <Input
            id="password" name="password" type={show ? "text" : "password"}
            autoComplete="off" required placeholder="••••••••" className="px-9"
          />
          <button
            type="button" onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="group w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        {!pending && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
      </Button>
    </form>
  );
}
