import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Check, MessageSquare, Sparkles, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ActionButton } from "@/components/action-button";
import {
  SUBSCRIPTION_PLANS, CURRENT_PLAN_CODE, FRANCHISE_PLAN,
  PRICE_NOTE, ADD_ONS, ANNUAL_DISCOUNT_PERCENT,
} from "@/lib/constants";
import { FEATURES } from "@/lib/features";
import { db } from "@/lib/db";
import { subscriptions, subscriptionPlans } from "@/lib/db/schema";
import { getActiveInstituteId } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing & Plans" };

export default async function BillingPage() {
  // Hidden unless the billing feature flag is on; block direct access too.
  if (!FEATURES.billing) redirect("/dashboard");

  // Show the center's real current plan (falls back to the demo default).
  const activeId = await getActiveInstituteId();
  let currentPlanCode: string = CURRENT_PLAN_CODE;
  if (activeId) {
    const [sub] = await db
      .select({ code: subscriptionPlans.code })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.instituteId, activeId))
      .limit(1);
    if (sub?.code) currentPlanCode = sub.code;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Plans"
        description="Simple, transparent pricing for institutes of every size."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const current = plan.code === currentPlanCode;
          return (
            <Card
              key={plan.code}
              className={cn(
                "relative flex flex-col",
                plan.popular && "border-primary ring-2 ring-primary/30"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1"><Sparkles className="size-3" /> Most popular</Badge>
                </span>
              )}
              <CardContent className="flex flex-1 flex-col gap-5 p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {current && <Badge variant="success">Current</Badge>}
                  </div>
                  <p className="mt-2">
                    <span className="text-3xl font-extrabold tracking-tight">{plan.priceLabel}</span>
                    {plan.price > 0 && <span className="text-sm text-muted-foreground">/month</span>}
                  </p>
                  {plan.launchPrice > 0 && plan.launchPrice < plan.price && (
                    <p className="text-xs font-bold text-emerald-600">
                      Launch offer — ₹{plan.launchPrice}/mo for your first month
                    </p>
                  )}
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{plan.students}</p>
                </div>

                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {current ? (
                  <ActionButton variant="outline" toastMessage="You're on this plan" className="w-full">
                    Current plan
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant={plan.popular ? "default" : "outline"}
                    toastMessage={`Switching to ${plan.name}`}
                    toastDescription="Our team will help you upgrade."
                    className="w-full"
                  >
                    {plan.price === 0 && plan.code !== "free" ? "Talk to sales" : `Choose ${plan.name}`}
                  </ActionButton>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{PRICE_NOTE}</p>
      <p className="text-sm text-muted-foreground">
        Add-ons: <strong>₹{ADD_ONS.extraStudent}</strong> per extra student / month ·{" "}
        <strong>₹{ADD_ONS.extraBranch}</strong> per extra branch / month · annual billing{" "}
        <strong>saves {ANNUAL_DISCOUNT_PERCENT}%</strong>.
      </p>

      {/* Franchise / multi-center tier */}
      <Card className="border-primary/30">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{FRANCHISE_PLAN.name}</h3>
              <Badge variant="outline">{FRANCHISE_PLAN.priceLabel} pricing</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{FRANCHISE_PLAN.blurb}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {FRANCHISE_PLAN.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <ActionButton toastMessage="Thanks!" toastDescription="We'll reach out about franchise pricing.">
            Talk to us
          </ActionButton>
        </CardContent>
      </Card>

      {/* WhatsApp — free on every plan, no quota, no top-up to sell */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <MessageSquare className="size-6" />
          </span>
          <div className="flex-1">
            <h3 className="font-bold">WhatsApp reminders — free on every plan</h3>
            <p className="text-sm text-muted-foreground">
              Reminders open ready-written in your own WhatsApp with the parent&apos;s name, the amount
              and your UPI QR filled in — you just press send. Unlimited, from your own number, at no
              cost. There are no message quotas and nothing to top up.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Prices exclude 18% GST. Pay monthly, or yearly and save {ANNUAL_DISCOUNT_PERCENT}%. Cancel anytime.
      </p>
    </div>
  );
}
