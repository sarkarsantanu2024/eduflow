"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/types/database.types";

/**
 * Client shell that owns sidebar state:
 *  - desktop: toggle collapses the sidebar to icon-only
 *  - mobile:  toggle opens it as an overlay drawer
 */
export function AppShell({
  profile,
  instituteName,
  planLabel,
  children,
}: {
  profile: ProfileRow;
  instituteName?: string;
  planLabel?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setCollapsed((c) => !c);
    } else {
      setMobileOpen((o) => !o);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        role={profile.role}
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
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
