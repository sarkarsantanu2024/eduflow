import { GraduationCap, Users, IndianRupee, MessageCircle } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

const features = [
  { icon: Users, label: "Manage students, batches & levels" },
  { icon: IndianRupee, label: "Collect fees online — UPI & cards" },
  { icon: MessageCircle, label: "Automatic WhatsApp fee reminders" },
];

// Free stock hero (Unsplash) — children learning, fits a coaching center.
const HERO =
  "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1400&q=80&auto=format&fit=crop";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Brand / purpose panel ───────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* hero image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover" />
        {/* brand gradient overlay for legibility + on-brand colour */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(160deg, hsl(20 92% 55% / 0.92) 0%, hsl(14 86% 48% / 0.88) 45%, hsl(6 74% 32% / 0.94) 100%)",
          }}
        />

        {/* logo */}
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">{APP_NAME}</span>
        </div>

        {/* purpose + functionality */}
        <div className="relative space-y-7">
          <div className="space-y-3">
            <h1 className="max-w-md text-4xl font-bold leading-[1.12] tracking-tight">
              The all-in-one software to run your coaching center.
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-white/85">
              {APP_NAME} brings admissions, fees and parent communication into one simple
              dashboard — so you spend less time on admin and more on teaching.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/55">© {APP_NAME}. All rights reserved.</p>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
