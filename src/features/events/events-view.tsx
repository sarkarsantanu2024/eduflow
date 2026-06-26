"use client";

import { PartyPopper, Sparkles, MapPin, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SendOnWhatsApp } from "@/components/send-on-whatsapp";
import { renderTemplate } from "@/lib/wa-link";
import {
  useCollection, useHydrated, useProfile, addItem, removeItem, loadSamples, newId, type InstituteEvent,
} from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";

const BODY = "You're invited! {{title}} on {{date}} at {{venue}}. Hope to see you there! — {{business}}";

export function EventsView() {
  const hydrated = useHydrated();
  const events = useCollection("events");
  const profile = useProfile();
  const biz = profile.businessName || "our institute";
  const ownerPhone = profile.whatsapp || profile.phone;

  const addBtn = (
    <FormDialog
      title="Add event" submitLabel="Add event" successMessage="Event added"
      description="Plan an annual function, exhibition or showcase."
      trigger={<Button><PartyPopper /> New event</Button>}
      fields={[
        { name: "title", label: "Title", required: true, placeholder: "Annual Function 2026" },
        { name: "date", label: "Date", type: "date" },
        { name: "venue", label: "Venue", placeholder: "Town Hall" },
        { name: "note", label: "Note", type: "textarea" },
      ]}
      onSubmit={(v) => addItem<InstituteEvent>("events", {
        id: newId("evt"), title: v("title"), date: v("date"), venue: v("venue"), note: v("note"),
      })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Events & Functions" description="Annual functions, exhibitions and showcases — with WhatsApp invites." actions={addBtn} />

      {!hydrated ? null : events.length === 0 ? (
        <EmptyState
          icon={PartyPopper} title="No events yet"
          description="Plan your annual function or exhibition and invite parents on WhatsApp."
          action={
            <div className="flex gap-2">
              {addBtn}
              <Button variant="outline" onClick={() => { loadSamples(); toast.success("Sample data loaded"); }}>
                <Sparkles /> Load sample data
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <PartyPopper className="size-5" />
                  </span>
                  <ConfirmDialog
                    title={`Delete "${e.title}"?`} confirmLabel="Delete" destructive
                    onConfirm={() => { removeItem("events", e.id); toast.success("Event deleted"); }}
                    trigger={<Button size="sm" variant="ghost">Delete</Button>}
                  />
                </div>
                <h3 className="font-bold">{e.title}</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {e.date && <p className="flex items-center gap-1.5"><CalendarDays className="size-4" /> {formatDate(e.date)}</p>}
                  {e.venue && <p className="flex items-center gap-1.5"><MapPin className="size-4" /> {e.venue}</p>}
                  {e.note && <p>{e.note}</p>}
                </div>
                <SendOnWhatsApp
                  className="w-full" phone={ownerPhone} label="Preview invite"
                  message={renderTemplate(BODY, { title: e.title, date: e.date ? formatDate(e.date) : "soon", venue: e.venue || "the centre", business: biz })}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
