"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, KeyRound, Ban, CheckCircle2, Trash2, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  createStaff, resetStaffPassword, setStaffActive, deleteStaff, type StaffData,
} from "@/features/staff/actions";

export function StaffView({ data }: { data: StaffData }) {
  const router = useRouter();
  const used = data.staff.length;
  const atLimit = data.limit !== null && used >= data.limit;
  const limitLabel = data.limit === null ? "Unlimited" : `${used} of ${data.limit}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Logins"
        description="Create login accounts for your teachers/staff. They sign in with their own username and password."
        actions={<AddStaffDialog atLimit={atLimit} planName={data.planName} limit={data.limit} onDone={() => router.refresh()} />}
      />

      <Card>
        <CardContent className="flex items-center justify-between p-4 text-sm">
          <span className="text-muted-foreground">Staff logins used ({data.planName} plan)</span>
          <span className="font-semibold">{limitLabel}</span>
        </CardContent>
      </Card>

      {used === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No staff logins yet"
          description="Add a login so a teacher can sign in to mark attendance, record marks and more."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username (login)</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.fullName || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{s.username}</TableCell>
                  <TableCell className="text-sm">{s.email}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "secondary"}>{s.isActive ? "Active" : "Suspended"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <ResetStaffDialog userId={s.id} name={s.fullName || s.email} onDone={() => router.refresh()} />
                      <form action={setStaffActive}>
                        <input type="hidden" name="userId" value={s.id} />
                        <input type="hidden" name="active" value={s.isActive ? "false" : "true"} />
                        {s.isActive ? (
                          <Button size="sm" variant="ghost" type="submit" className="text-amber-600"><Ban className="size-3.5" /> Suspend</Button>
                        ) : (
                          <Button size="sm" variant="ghost" type="submit" className="text-emerald-600"><CheckCircle2 className="size-3.5" /> Activate</Button>
                        )}
                      </form>
                      <ConfirmDialog
                        title={`Remove ${s.fullName || s.email}?`}
                        description="This permanently deletes their login. They will no longer be able to sign in."
                        confirmLabel="Remove" destructive
                        onConfirm={async () => {
                          const fd = new FormData(); fd.set("userId", s.id);
                          await deleteStaff(fd); toast.success("Staff login removed"); router.refresh();
                        }}
                        trigger={<Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="size-3.5" /></Button>}
                      />
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

function AddStaffDialog({ atLimit, planName, limit, onDone }: { atLimit: boolean; planName: string; limit: number | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => {
      const res = await createStaff(fd);
      if (res.ok) { toast.success("Staff login created"); setOpen(false); onDone(); }
      return res;
    },
    undefined,
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={atLimit} title={atLimit ? "Plan staff limit reached" : undefined}>
        <UserPlus /> Add staff login
      </Button>
      {atLimit && (
        <span className="ml-2 text-xs text-muted-foreground">
          {planName} plan limit ({limit}) reached — upgrade to add more.
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New staff login</DialogTitle>
            <DialogDescription>They&apos;ll sign in at the login page with this username + password.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3" autoComplete="off">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username (login)</Label>
              <Input id="username" name="username" required autoComplete="off" placeholder="teacher-username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="text" minLength={8} required placeholder="At least 8 characters" autoComplete="off" />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create login"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetStaffDialog({ userId, name, onDone }: { userId: string; name: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => {
      const res = await resetStaffPassword(fd);
      if (res.ok) { toast.success("Password reset"); setOpen(false); onDone(); }
      return res;
    },
    undefined,
  );

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><KeyRound className="size-3.5" /> Reset</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {name} and share it with them.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3" autoComplete="off">
            <input type="hidden" name="userId" value={userId} />
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" name="newPassword" type="text" minLength={8} required placeholder="At least 8 characters" autoComplete="off" />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
