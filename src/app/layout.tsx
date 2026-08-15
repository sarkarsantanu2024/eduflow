import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { clientEnv } from "@/lib/env";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${clientEnv.NEXT_PUBLIC_APP_NAME} — Institute Management SaaS`,
    template: `%s · ${clientEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description: "Complete Institute Management, Fee Collection & WhatsApp Reminder Platform",
  openGraph: {
    type: "website",
    siteName: clientEnv.NEXT_PUBLIC_APP_NAME,
    title: `${clientEnv.NEXT_PUBLIC_APP_NAME} — Institute Management SaaS`,
    description: "Admissions, fees, UPI-QR collection, WhatsApp reminders, attendance and reports in one place. Free up to 20 students.",
    images: [{ url: "/og-cover.png", width: 1200, height: 600, alt: `${clientEnv.NEXT_PUBLIC_APP_NAME} — run your center on autopilot` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${clientEnv.NEXT_PUBLIC_APP_NAME} — Institute Management SaaS`,
    description: "Admissions, fees, UPI-QR collection, WhatsApp reminders, attendance and reports in one place.",
    images: ["/og-cover.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
        {/* Google Analytics 4 — only when NEXT_PUBLIC_GA_ID is set (production). */}
        {clientEnv.NEXT_PUBLIC_GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${clientEnv.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${clientEnv.NEXT_PUBLIC_GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
