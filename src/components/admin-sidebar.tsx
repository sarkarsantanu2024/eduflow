"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Building2, Gauge } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/capacity", label: "Capacity requests", icon: Gauge },
];

/**
 * Left navigation for the platform-admin console.
 *
 * Sticky from md up. The console's long pages (all customers, leads, demo
 * centres) scrolled the nav off screen, so reaching another section meant
 * scrolling back to the top first. `top-14` clears the sticky header, and the
 * height fills what is left so the nav scrolls on its own if it ever outgrows
 * the viewport. Below md it stays a horizontal strip of chips above the page.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (item: (typeof ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav
      aria-label="Admin sections"
      className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:w-56 md:flex-col md:justify-start md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4"
    >
      {ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <item.icon className="size-4 shrink-0" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
