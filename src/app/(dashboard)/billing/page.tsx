import type { Metadata } from "next";
import { Check, MessageSquare, Sparkles, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ActionButton } from "@/components/action-button";
import { SUBSCRIPTION_PLANS, CURRENT_PLAN_CODE, FRANCHISE_PLAN } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing & Plans" };

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Plans"
        description="Simple, transparent pricing for institutes of every size."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const current = plan.code === CURRENT_PLAN_CODE;
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
                    <span className="text-3xl font-extrabold tracking-tight">₹{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </p>
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
                    Choose {plan.name}
                  </ActionButton>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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

      {/* Add-on */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <MessageSquare className="size-6" />
          </span>
          <div className="flex-1">
            <h3 className="font-bold">WhatsApp add-on</h3>
            <p className="text-sm text-muted-foreground">
              Each plan includes a monthly WhatsApp quota. Extra messages are billed as a top-up
              (utility messages ≈ ₹0.15 each). Buy top-ups any time as you grow.
            </p>
          </div>
          <ActionButton variant="outline" toastMessage="Top-up added" toastDescription="1,000 WhatsApp messages added.">
            Buy top-up
          </ActionButton>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Prices exclude GST. Pay monthly or yearly via UPI / cards. Cancel anytime.
      </p>
    </div>
  );
}
