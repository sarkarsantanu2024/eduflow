"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";
import {
  signIn, signInWithGoogle, requestOtp, verifyOtp, type AuthState, type OtpState,
} from "@/features/auth/actions";
import { DEMO_MODE, DEMO_CREDENTIALS } from "@/lib/demo";

type Method = "password" | "otp";

export default function LoginPage() {
  const [method, setMethod] = useState<Method>("password");

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

      {DEMO_MODE && (
        <p className="rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2.5 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">Demo mode</span> — any method works. Password
          is pre-filled; for the email code, enter any 6 digits.
        </p>
      )}

      {/* Google OAuth */}
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full gap-2.5">
          <GoogleIcon /> Continue with Google
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>

      {/* Method toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <ToggleTab active={method === "password"} onClick={() => setMethod("password")} icon={Lock}>
          Password
        </ToggleTab>
        <ToggleTab active={method === "otp"} onClick={() => setMethod("otp")} icon={KeyRound}>
          Email code
        </ToggleTab>
      </div>

      {method === "password" ? <PasswordForm /> : <OtpForm />}

      <p className="text-center text-sm text-muted-foreground">
        New to {APP_NAME}?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

/* ── Password sign-in ─────────────────────────────────────────── */
function PasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Mail className="input-icon" />
        <Input
          id="email" name="email" type="email" autoComplete="email" required
          placeholder="you@institute.com" className="pl-9"
          defaultValue={DEMO_MODE ? DEMO_CREDENTIALS.email : undefined}
        />
      </Field>

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
            autoComplete="current-password" required placeholder="••••••••" className="px-9"
            defaultValue={DEMO_MODE ? DEMO_CREDENTIALS.password : undefined}
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

      {state?.error && <ErrorNote>{state.error}</ErrorNote>}

      <Button type="submit" className="group w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        {!pending && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
      </Button>
    </form>
  );
}

/* ── Passwordless email OTP ───────────────────────────────────── */
function OtpForm() {
  const [reqState, requestAction, reqPending] = useActionState<OtpState, FormData>(requestOtp, undefined);
  const [verState, verifyAction, verPending] = useActionState<OtpState, FormData>(verifyOtp, undefined);
  const [reenter, setReenter] = useState(false);

  const sent = !!reqState?.sent && !reenter;

  if (!sent) {
    return (
      <form action={requestAction} onSubmit={() => setReenter(false)} className="space-y-4">
        <Field label="Email" htmlFor="otp-email">
          <Mail className="input-icon" />
          <Input
            id="otp-email" name="email" type="email" autoComplete="email" required
            placeholder="you@institute.com" className="pl-9"
            defaultValue={reqState?.email ?? (DEMO_MODE ? DEMO_CREDENTIALS.email : undefined)}
          />
        </Field>
        {reqState?.error && <ErrorNote>{reqState.error}</ErrorNote>}
        <Button type="submit" className="w-full" disabled={reqPending}>
          {reqPending ? "Sending code…" : "Send login code"}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{reqState?.email}</span>.
        {DEMO_MODE && " Demo mode — enter any 6 digits."}
      </p>
      <input type="hidden" name="email" value={reqState?.email ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="token">Login code</Label>
        <Input
          id="token" name="token" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} required placeholder="000000" autoFocus
          className="text-center text-lg font-semibold tracking-[0.5em]"
        />
      </div>
      {verState?.error && <ErrorNote>{verState.error}</ErrorNote>}
      <Button type="submit" className="group w-full" disabled={verPending}>
        {verPending ? "Verifying…" : "Verify & sign in"}
        {!verPending && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
      </Button>
      <button
        type="button" onClick={() => setReenter(true)}
        className="block w-full text-center text-xs font-medium text-primary hover:underline"
      >
        Use a different email
      </button>
    </form>
  );
}

/* ── small presentational helpers ─────────────────────────────── */
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative">{children}</div>
    </div>
  );
}

function ToggleTab({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: typeof Lock; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>;
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
