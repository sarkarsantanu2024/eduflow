"use client";

import Link from "next/link";
import { Menu, Bell, LifeBuoy, LogOut, User, LayoutDashboard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/auth/actions";
import { DEMO_MODE, demoNotifications } from "@/lib/demo";
import { useProfile } from "@/lib/store/local-db";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/types/database.types";

export function Header({
  profile,
  instituteName,
  planLabel,
  onToggleSidebar,
}: {
  profile: ProfileRow;
  instituteName?: string;
  planLabel?: string;
  onToggleSidebar?: () => void;
}) {
  const storeProfile = useProfile();
  const displayName = storeProfile.ownerName || profile.full_name || "User";
  const displayEmail = storeProfile.email || profile.email || "";
  const businessName = storeProfile.businessName || instituteName || "EduFlow";

  const initials = displayName
    ? displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const notifications = DEMO_MODE ? demoNotifications : [];
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{businessName}</p>
          <p className="text-xs capitalize text-muted-foreground">{profile.role.replace("_", " ")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {planLabel && (
          <span className="hidden items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-semibold lg:inline-flex">
            <span className="size-1.5 rounded-full bg-primary" />
            {planLabel}
          </span>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span className="font-bold">Notifications</span>
              {unread > 0 && <span className="text-xs font-medium text-primary">{unread} new</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2.5">
                  <div className="flex w-full items-center gap-2">
                    {n.unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="font-semibold">{n.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{n.time}</span>
                  </div>
                  <span className={cn("text-xs text-muted-foreground", n.unread && "pl-3.5")}>{n.body}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="justify-center text-sm font-semibold text-primary">
                View all
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition-colors hover:bg-accent">
              <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {storeProfile.avatar ? <img src={storeProfile.avatar} alt="" className="size-9 object-cover" /> : initials}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold">{displayName}</span>
                <span className="block text-xs text-muted-foreground">{displayEmail}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <p className="font-bold">{displayName}</p>
              <p className="text-xs font-normal capitalize text-muted-foreground">
                {profile.role.replace("_", " ")}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile"><User /> My Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard"><LayoutDashboard /> Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/support"><LifeBuoy /> Help &amp; Support</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full text-destructive focus:text-destructive">
                  <LogOut /> Log out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
