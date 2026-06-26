"use client";

import { Mail, MessageCircle, Phone, BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SUPPORT } from "@/lib/constants";
import { getFaqs } from "@/lib/sectors";
import { useProfile } from "@/lib/store/local-db";
import { waLink } from "@/lib/wa-link";

export function SupportView() {
  const { businessType } = useProfile();
  const faqs = getFaqs(businessType);

  const channels = [
    {
      icon: MessageCircle,
      title: "WhatsApp support",
      desc: "Fastest way to reach us — we usually reply within an hour.",
      cta: `Chat with ${SUPPORT.ownerName.split(" ")[0]}`,
      href: waLink(SUPPORT.whatsapp, `Hi ${SUPPORT.ownerName}, I need help with ${SUPPORT.productName}.`),
    },
    {
      icon: Mail,
      title: "Email us",
      desc: "Share details and screenshots for account or billing issues.",
      cta: SUPPORT.email,
      href: `mailto:${SUPPORT.email}`,
    },
    {
      icon: Phone,
      title: "Call us",
      desc: `${SUPPORT.hours} for urgent help.`,
      cta: `+91 ${SUPPORT.phone}`,
      href: `tel:+91${SUPPORT.phone}`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Help & Support" description="We're here to help you run your institute smoothly." />

      <div className="grid gap-4 sm:grid-cols-3">
        {channels.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.title}>
              <CardContent className="space-y-3 p-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </div>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  {c.cta} <ExternalLink className="size-3.5" />
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Frequently asked questions
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {faqs.map((f) => (
            <div key={f.q} className="py-4 first:pt-0 last:pb-0">
              <p className="font-semibold">{f.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
