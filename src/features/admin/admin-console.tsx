"use client";

import { useActionState, useState } from "react";
import { Building2, Users, IndianRupee, AlertCircle, LogIn, KeyRound, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { BUSINESS_TYPES } from "@/lib/constants";
import { openCenter, resetOwnerPassword, setCenterActive, deleteCenter, type CustomerRow } from "@/features/admin/actions";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const typeLabel = (t: string) => BUSINESS_TYPES.find((b) => b.value === t)?.label ?? t;

export function AdminConsole({ customers }: { customers: CustomerRow[] }) {
  const totals = customers.reduce(
    (a, c) => ({ students: a.students + c.students, revenue: a.revenue + c.revenue, pending: a.pending + c.pending }),
    { students: 0, revenue: 0, pending: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader title="All Customers" description="Every center on EduFlow — open one to help, or reset an owner's password." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Centers" value={String(customers.length)} />
        <Stat icon={Users} label="Students (all centers)" value={String(totals.students)} />
        <Stat icon={IndianRupee} label="Total collected" value={rupees(totals.revenue)} />
        <Stat icon={AlertCircle} label="Total pending dues" value={rupees(totals.pending)} />
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={Building2} title="No customers yet" description="Centers appear here as soon as owners register." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Center</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.name}
                    {!c.isActive && <Badge variant="destructive" className="ml-2">Suspended</Badge>}
                    {c.isActive && !c.onboarded && <Badge variant="warning" className="ml-2">Setup pending</Badge>}
                  </TableCell>
                  <TableCell>{typeLabel(c.type)}</TableCell>
                  <TableCell>
                    {c.plan} <span className="text-xs text-muted-foreground">({c.planStatus})</span>
                  </TableCell>
                  <TableCell className="text-right">{c.activeStudents}/{c.students}</TableCell>
                  <TableCell className="text-right">{rupees(c.revenue)}</TableCell>
                  <TableCell className="text-right">{rupees(c.pending)}</TableCell>
                  <TableCell className="text-xs">{c.ownerEmail ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <form action={openCenter}>
                        <input type="hidden" name="instituteId" value={c.id} />
                        <Button size="sm" variant="outline" type="submit"><LogIn className="size-3.5" /> Open</Button>
                      </form>
                      {c.ownerId && <ResetPasswordDialog ownerId={c.ownerId} email={c.ownerEmail ?? ""} />}
                      <form action={setCenterActive}>
                        <input type="hidden" name="instituteId" value={c.id} />
                        <input type="hidden" name="active" value={c.isActive ? "false" : "true"} />
                        {c.isActive ? (
                          <Button size="sm" variant="ghost" type="submit" className="text-destructive"><Ban className="size-3.5" /> Suspend</Button>
                        ) : (
                          <Button size="sm" variant="ghost" type="submit" className="text-emerald-600"><CheckCircle2 className="size-3.5" /> Activate</Button>
                        )}
                      </form>
                      <DeleteCenterDialog instituteId={c.id} name={c.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ResetPasswordDialog({ ownerId, email }: { ownerId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => resetOwnerPassword(formData),
    undefined,
  );

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><KeyRound className="size-3.5" /> Reset</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset owner password</DialogTitle>
            <DialogDescription>Set a new password for {email || "this owner"}. Share it with them securely.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="userId" value={ownerId} />
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" name="newPassword" type="text" minLength={8} required placeholder="At least 8 characters" autoComplete="off" />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state?.ok && <p className="text-sm text-emerald-600">Password updated.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteCenterDialog({ instituteId, name }: { instituteId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => deleteCenter(formData),
    undefined,
  );

  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirm(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete center</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{name}</strong> and all its data — students, fees,
              payments, staff and owner accounts. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="instituteId" value={instituteId} />
            <div className="space-y-1.5">
              <Label htmlFor={`confirm-${instituteId}`}>Type <strong>{name}</strong> to confirm</Label>
              <Input
                id={`confirm-${instituteId}`}
                name="confirmName"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={name}
                autoComplete="off"
              />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={pending || confirm.trim() !== name}>
                {pending ? "Deleting…" : "Delete center"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
