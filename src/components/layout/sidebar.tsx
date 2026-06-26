"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { NAV_ITEMS, getLabels, getSector } from "@/lib/constants";
import { useProfile } from "@/lib/store/local-db";
import type { UserRole } from "@/types/database.types";

export function Sidebar({
  role,
  collapsed = false,
  mobileOpen = false,
  onNavigate,
}: {
  role: UserRole;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { businessType } = useProfile();
  const labels = getLabels(businessType);
  const enabledModules = getSector(businessType).modules;
  const items = NAV_ITEMS.filter(
    (i) =>
      (i.roles.includes(role) || role === "super_admin") &&
      (!i.module || enabledModules.includes(i.module)),
  );

  return (
    <aside
      className={cn(
        "z-40 flex shrink-0 flex-col border-r bg-card transition-[width,transform] duration-200",
        // desktop width
        collapsed ? "md:w-[76px]" : "md:w-64",
        // mobile: fixed drawer
        "fixed inset-y-0 left-0 w-64 md:static md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo showText={!collapsed} />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = item.labelKey ? labels[item.labelKey] : item.title;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
