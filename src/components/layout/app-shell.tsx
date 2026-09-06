"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { OnboardingGateDialog } from "./onboarding-gate";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { RoleProvider } from "./role-context";
import { cn } from "@/lib/utils";
import { exitCenter } from "@/features/admin/actions";
import { useActiveTenant } from "@/lib/store/local-db";
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
  activeInstituteId = null,
  planLabel,
  planCode,
  needsOnboarding = false,
  impersonating = false,
  children,
}: {
  profile: ProfileRow;
  effectiveRole?: UserRole;
  instituteName?: string;
  activeInstituteId?: string | null;
  planLabel?: string;
  planCode?: string;
  needsOnboarding?: boolean;
  impersonating?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navRole = effectiveRole ?? profile.role;

  // Bind the client data cache to the active tenant; resets + reloads when the
  // signed-in center changes so the previous user's data never carries over.
  useActiveTenant(activeInstituteId);

  // New center owners must finish their profile before using the app. The
  // redirect alone reads as a broken app, so we explain it in a dismissible
  // modal. This component lives in the layout, so `gateOpen` survives the
  // client navigation and the modal is still up once we land on /profile.
  const blocked = needsOnboarding && pathname !== "/profile";
  const [gateOpen, setGateOpen] = useState(false);
  useEffect(() => {
    if (blocked) {
      setGateOpen(true);
      router.replace("/profile");
    }
  }, [blocked, router]);

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
        planCode={planCode}
        activeInstituteId={activeInstituteId}
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
              as {profile.role === "org_admin" ? "Head Office" : "platform admin"}.
              Changes affect this center&apos;s live data.
            </span>
            <form action={exitCenter}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium hover:bg-amber-200"
              >
                <LogOut className="size-3.5" />{" "}
                {profile.role === "org_admin" ? "Exit to Head Office" : "Exit to admin"}
              </button>
            </form>
          </div>
        )}
        <main className="nice-scroll flex-1 overflow-auto">
          <div className="w-full px-3 py-4 sm:px-8 sm:py-5">
            {/* Don't paint the blocked page while the redirect is in flight —
                flashing "No students yet" and then bouncing away is worse than
                showing nothing for a moment. */}
            {blocked ? null : <RoleProvider role={navRole}>{children}</RoleProvider>}
          </div>
        </main>
      </div>

      <OnboardingGateDialog open={gateOpen} onOpenChange={setGateOpen} />
    </div>
  );
}
