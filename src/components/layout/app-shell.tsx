"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { exitCenter } from "@/features/admin/actions";
import type { ProfileRow, UserRole } from "@/types/database.types";

/**
 * Client shell that owns sidebar state:
 *  - desktop: toggle collapses the sidebar to icon-only
 *  - mobile:  toggle opens it as an overlay drawer
 */
export function AppShell({
  profile,
  effectiveRole,
  instituteName,
  planLabel,
  needsOnboarding = false,
  impersonating = false,
  children,
}: {
  profile: ProfileRow;
  effectiveRole?: UserRole;
  instituteName?: string;
  planLabel?: string;
  needsOnboarding?: boolean;
  impersonating?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navRole = effectiveRole ?? profile.role;

  // New center owners must finish their profile before using the app.
  useEffect(() => {
    if (needsOnboarding && pathname !== "/profile") {
      router.replace("/profile");
    }
  }, [needsOnboarding, pathname, router]);

  function toggle() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setCollapsed((c) => !c);
    } else {
      setMobileOpen((o) => !o);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        role={navRole}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className={cn("flex min-w-0 flex-1 flex-col")}>
        <Header
          profile={profile}
          instituteName={instituteName}
          planLabel={planLabel}
          onToggleSidebar={toggle}
        />
        {impersonating && (
          <div className="flex items-center justify-between gap-3 border-b bg-amber-100 px-4 py-2 text-sm text-amber-900 sm:px-6">
            <span>
              You are managing <strong>{instituteName ?? "this center"}</strong>{" "}
              as platform admin. Changes affect the customer&apos;s live data.
            </span>
            <form action={exitCenter}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium hover:bg-amber-200"
              >
                <LogOut className="size-3.5" /> Exit to admin
              </button>
            </form>
          </div>
        )}
        <main className="nice-scroll flex-1 overflow-auto">
          <div className="w-full px-3 py-4 sm:px-8 sm:py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
