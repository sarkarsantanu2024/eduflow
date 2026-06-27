"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, QrCode, Database, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BUSINESS_TYPES } from "@/lib/constants";
import { getSector, ALL_MODULES, MODULE_LABELS } from "@/lib/sectors";
import {
  useProfile, useHydrated, setProfile, resetDb, type Profile,
} from "@/lib/store/local-db";
import { saveProfile as persistProfile } from "@/features/data/actions";
import { ChangePasswordCard } from "@/features/auth/change-password-card";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useProfile();
  const avatarRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile({ [key]: value } as Partial<Profile>);
  }

  function changeBusinessType(value: string) {
    set("businessType", value); // menus + labels switch instantly
  }

  // Persist the whole profile, then refresh so the onboarding gate clears.
  async function save() {
    setSaving(true);
    try {
      await persistProfile(profile);
      toast.success("Profile saved");
      router.refresh();
    } catch {
      toast.error("Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function upload(key: "avatar" | "qrImage") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => set(key, String(reader.result));
      reader.readAsDataURL(file);
    };
  }

  if (!hydrated) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your account, business, payment and contact details — saved securely to your account."
      />

      {/* Identity */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row">
          <div className="relative">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {profile.avatar ? <img src={profile.avatar} alt="" className="size-20 object-cover" /> : (profile.ownerName?.[0] ?? "U")}
            </span>
            <button type="button" onClick={() => avatarRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border bg-card shadow" aria-label="Upload photo">
              <Camera className="size-4" />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={upload("avatar")} />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold">{profile.ownerName || "Your name"}</h2>
            <p className="text-sm text-muted-foreground">{profile.email || "your@email.com"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input value={profile.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
            <Field label="Phone"><Input value={profile.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={profile.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="WhatsApp"><Input value={profile.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name"><Input value={profile.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
            <Field label="Business type">
              <select className={selectClass} value={profile.businessType} onChange={(e) => changeBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Monthly fee (₹)">
              <Input type="number" value={profile.monthlyFee || ""} onChange={(e) => set("monthlyFee", Number(e.target.value) || 0)} placeholder="500" />
            </Field>
            <Field label="Reactivation fee (₹)">
              <Input type="number" value={profile.reactivationFee || ""} onChange={(e) => set("reactivationFee", Number(e.target.value) || 0)} placeholder="700" />
            </Field>
            <Field label="GST number"><Input value={profile.gst} onChange={(e) => set("gst", e.target.value)} /></Field>
            <Field label="City"><Input value={profile.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Website" full><Input value={profile.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
            <Field label="Address" full>
              <textarea className={`${selectClass} min-h-20 py-2`} value={profile.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Modules for your business</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{getSector(profile.businessType).tagline}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((m) => {
                const on = getSector(profile.businessType).modules.includes(m);
                return (
                  <Badge key={m} variant={on ? "success" : "outline"} className={on ? "gap-1" : "gap-1 opacity-50"}>
                    {on && <Check className="size-3" />}{MODULE_LABELS[m]}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Change the business type above to switch which menus and terminology appear for your center.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="UPI ID"><Input value={profile.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="name@bank" /></Field>
            <div className="space-y-1.5">
              <Label>Payment QR code</Label>
              <div className="flex items-center gap-4">
                <span className="flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {profile.qrImage ? <img src={profile.qrImage} alt="QR" className="size-24 object-contain" /> : <QrCode className="size-8 text-muted-foreground" />}
                </span>
                <div>
                  <Button type="button" variant="outline" onClick={() => qrRef.current?.click()}>Upload QR image</Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">Your PhonePe / GPay / Paytm QR — shown to parents at collection.</p>
                </div>
                <input ref={qrRef} type="file" accept="image/*" hidden onChange={upload("qrImage")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Social & links</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Facebook"><Input value={profile.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="facebook.com/…" /></Field>
            <Field label="Instagram"><Input value={profile.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="instagram.com/…" /></Field>
            <Field label="YouTube"><Input value={profile.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="youtube.com/…" /></Field>
          </CardContent>
        </Card>
      </div>

      {/* Data controls */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Database className="size-6" />
          </span>
          <div className="flex-1">
            <h3 className="font-bold">Center data</h3>
            <p className="text-sm text-muted-foreground">
              All your records are saved securely to your account. Clearing removes every student, fee,
              payment and other record for this center — your login and profile stay.
            </p>
          </div>
          <div className="flex gap-2">
            <ConfirmDialog
              title="Clear all data?"
              description="This permanently removes all students, courses, fees, payments and other records for this center."
              confirmLabel="Clear everything" destructive
              onConfirm={() => { resetDb(); toast.success("All data cleared"); }}
              trigger={<Button variant="outline">Clear all data</Button>}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account security */}
      <ChangePasswordCard />

      {/* Sticky save bar — stays visible while scrolling the long form */}
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
