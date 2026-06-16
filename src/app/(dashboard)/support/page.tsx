import type { Metadata } from "next";
import { Mail, MessageCircle, Phone, BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Support" };

const channels = [
  {
    icon: MessageCircle,
    title: "WhatsApp support",
    desc: "Fastest way to reach us — typically replies within an hour.",
    cta: "Chat on WhatsApp",
    href: "https://wa.me/919800000000?text=Hi%20EduFlow%20Support",
  },
  {
    icon: Mail,
    title: "Email us",
    desc: "Share details and screenshots for account or billing issues.",
    cta: "support@eduflow.app",
    href: "mailto:support@eduflow.app",
  },
  {
    icon: Phone,
    title: "Call us",
    desc: "Mon–Sat, 10 AM – 7 PM IST for urgent help.",
    cta: "+91 98000 00000",
    href: "tel:+919800000000",
  },
];

const faqs = [
  { q: "How do I collect fees online?", a: "Go to Fees → Collect, or Payments → Create payment link. EduFlow generates a Razorpay/UPI link you can send on WhatsApp; once paid, the receipt is issued automatically." },
  { q: "Can I record cash payments?", a: "Yes. Mark a fee as paid with the Cash method — EduFlow still generates a receipt and a WhatsApp confirmation, no gateway needed." },
  { q: "How do WhatsApp reminders work?", a: "Create reusable templates under WhatsApp Reminders. Fee-due and overdue reminders are sent automatically on schedule." },
  { q: "How do I add staff or teachers?", a: "Settings → Team (Growth plan and above). Each member gets role-based access." },
];

export default function SupportPage() {
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
