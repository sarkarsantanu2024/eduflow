"use client";

import Link from "next/link";
import { Bell, IndianRupee, Users, GraduationCap, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/store/local-db";
import { useNotifications, markNotificationsRead, type NotificationCategory } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database.types";

const CATEGORY: Record<NotificationCategory, { label: string; icon: typeof Bell; tone: string }> = {
  money: { label: "Fees", icon: IndianRupee, tone: "bg-rose-100 text-rose-600" },
  students: { label: "Students", icon: Users, tone: "bg-emerald-100 text-emerald-600" },
  academics: { label: "Academics", icon: GraduationCap, tone: "bg-indigo-100 text-indigo-600" },
  events: { label: "Events", icon: PartyPopper, tone: "bg-amber-100 text-amber-600" },
};

export function NotificationsView({ role }: { role: UserRole }) {
  const hydrated = useHydrated();
  const notifications = useNotifications(role);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Live updates from your data — fees, collection, absentees, admissions, birthdays and upcoming dates. Always reflects the latest."
        actions={unread > 0 ? <Button variant="outline" size="sm" onClick={() => markNotificationsRead(notifications.map((n) => n.id))}>Mark all read</Button> : undefined}
      />

      {hydrated && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New admissions, overdue fees, birthdays and upcoming exams/events will show up here automatically."
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">{notifications.length} notification{notifications.length === 1 ? "" : "s"}</span>
            {unread > 0 && <span className="text-xs font-medium text-primary">{unread} new</span>}
          </div>
          {notifications.map((n) => {
            const meta = CATEGORY[n.category];
            const Icon = meta.icon;
            const Row = (
              <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="font-semibold">{n.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</p>
                </div>
              </div>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className="block" onClick={() => markNotificationsRead([n.id])}>{Row}</Link>
            ) : (
              <button key={n.id} type="button" className="block w-full text-left" onClick={() => markNotificationsRead([n.id])}>{Row}</button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
