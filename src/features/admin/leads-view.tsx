"use client";

import { useState } from "react";
import {
  Inbox, Phone, MessageSquare, Trash2, StickyNote, Users, CheckCircle2, XCircle, CalendarCheck, PhoneCall,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ExportData } from "@/components/export-data";
import { setLeadStatus, saveLeadNotes, deleteLead } from "@/features/admin/lead-actions";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadRow } from "@/lib/leads";

const STATUS_STYLE: Record<string, "default" | "success" | "outline" | "destructive"> = {
  new: "default",
  contacted: "outline",
  demo_booked: "outline",
  won: "success",
  lost: "destructive",
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Digits-only phone, so wa.me links work with or without a country code. */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Super-admin sales pipeline: every enquiry from the marketing site. */
export function LeadsView({ leads }: { leads: LeadRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [noteFor, setNoteFor] = useState<LeadRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadRow | null>(null);

  const counts = leads.reduce<Record<string, number>>((a, l) => {
    a[l.status] = (a[l.status] ?? 0) + 1;
    return a;
  }, {});
  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Every enquiry from the “Book your free demo” form on your website. Call them the same day — speed wins these deals."
        actions={
          <ExportData
            filename="eduflow-leads"
            rows={shown}
            columns={[
              { header: "Date", value: (l) => fmtDate(l.createdAt) },
              { header: "Name", value: (l) => l.name },
              { header: "Center", value: (l) => l.centerName },
              { header: "Type", value: (l) => l.centerType },
              { header: "Students", value: (l) => l.students ?? "" },
              { header: "Phone", value: (l) => l.phone },
              { header: "Email", value: (l) => l.email ?? "" },
              { header: "City", value: (l) => l.city ?? "" },
              { header: "Source", value: (l) => l.source },
              { header: "Status", value: (l) => LEAD_STATUS_LABELS[l.status] ?? l.status },
              { header: "Notes", value: (l) => l.notes },
            ]}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Inbox} label="Total leads" value={leads.length} active={filter === "all"} onClick={() => setFilter("all")} />
        <Stat icon={Users} label="New" value={counts.new ?? 0} active={filter === "new"} onClick={() => setFilter("new")} />
        <Stat icon={PhoneCall} label="Contacted" value={counts.contacted ?? 0} active={filter === "contacted"} onClick={() => setFilter("contacted")} />
        <Stat icon={CalendarCheck} label="Demo booked" value={counts.demo_booked ?? 0} active={filter === "demo_booked"} onClick={() => setFilter("demo_booked")} />
        <Stat icon={CheckCircle2} label="Won" value={counts.won ?? 0} active={filter === "won"} onClick={() => setFilter("won")} />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={leads.length === 0 ? "No leads yet" : "Nothing in this stage"}
          description={
            leads.length === 0
              ? "Enquiries from your website's demo form land here automatically. Make sure the site's API_BASE points at this app."
              : "Try another stage, or choose Total leads to see everything."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Name &amp; center</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className={stickyActionsHead}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(lead.createdAt)}</TableCell>
                    <TableCell>
                      <p className="font-semibold">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.centerName || "—"}</p>
                      {lead.notes && (
                        <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">{lead.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{lead.centerType || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{lead.students ?? "—"}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{lead.phone}</p>
                      {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                      {lead.city && <p className="text-xs text-muted-foreground">{lead.city}</p>}
                    </TableCell>
                    <TableCell>
                      <form action={setLeadStatus} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={lead.id} />
                        <Badge variant={STATUS_STYLE[lead.status] ?? "outline"}>
                          {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                        </Badge>
                        <select
                          name="status"
                          defaultValue={lead.status}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          aria-label={`Change status for ${lead.name}`}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </form>
                    </TableCell>
                    <TableCell className={stickyActionsCell}>
                      <div className="flex justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline" title="Call">
                          <a href={`tel:${lead.phone}`}><Phone className="size-3.5" /></a>
                        </Button>
                        <Button asChild size="sm" variant="outline" title="Message on WhatsApp">
                          <a
                            href={`https://wa.me/${waNumber(lead.phone)}?text=${encodeURIComponent(
                              `Hello ${lead.name}, this is EduFlow. Thank you for your enquiry about ${lead.centerName || "your center"}. When would be a good time for a quick 20-minute demo?`,
                            )}`}
                            target="_blank"
                            rel="noopener"
                          >
                            <MessageSquare className="size-3.5" />
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" title="Notes" onClick={() => setNoteFor(lead)}>
                          <StickyNote className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" title="Delete" onClick={() => setConfirmDelete(lead)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Dialog open={Boolean(noteFor)} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {noteFor?.name}</DialogTitle>
            <DialogDescription>
              Private to you. What they said, what they need, when to follow up.
            </DialogDescription>
          </DialogHeader>
          {noteFor?.message && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              <span className="font-semibold">Their message: </span>{noteFor.message}
            </p>
          )}
          <form action={saveLeadNotes} onSubmit={() => setNoteFor(null)} className="space-y-3">
            <input type="hidden" name="id" value={noteFor?.id ?? ""} />
            <textarea
              name="notes"
              rows={5}
              defaultValue={noteFor?.notes ?? ""}
              placeholder="Called 4 Aug — wants to see the dance demo. Follow up Monday."
              className="w-full rounded-lg border bg-background p-3 text-sm"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNoteFor(null)}>Cancel</Button>
              <Button type="submit">Save notes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.name} ({confirmDelete?.centerName || "no center given"}) will be removed
              from your pipeline. Use this for spam and duplicates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <form action={deleteLead} onSubmit={() => setConfirmDelete(null)}>
              <input type="hidden" name="id" value={confirmDelete?.id ?? ""} />
              <Button type="submit" variant="destructive"><XCircle className="size-4" /> Delete lead</Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, active, onClick }: {
  icon: typeof Inbox; label: string; value: number; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={active ? "border-primary ring-2 ring-primary/25" : "transition hover:border-primary/40"}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-xl font-extrabold leading-none">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
