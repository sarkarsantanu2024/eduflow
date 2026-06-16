import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  title: {
    default: `${clientEnv.NEXT_PUBLIC_APP_NAME} — Institute Management SaaS`,
    template: `%s · ${clientEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description: "Complete Institute Management, Fee Collection & WhatsApp Reminder Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
