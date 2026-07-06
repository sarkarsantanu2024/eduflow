"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Pencil, UserPlus, Link2, ArrowLeft, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, stickyActionsHead, stickyActionsCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  createOrganization, updateOrganization, createOrgAdmin, assignBranch,
  type OrgRow, type AssignCenterRow,
} from "@/features/admin/org-actions";
import { resetOwnerPassword } from "@/features/admin/actions";

export function OrganizationsConsole({ orgs, centers }: { orgs: OrgRow[]; centers: AssignCenterRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin"><Button variant="ghost" size="sm"><ArrowLeft className="size-3.5" /> All customers</Button></Link>
      </div>
      <PageHeader
        title="Organizations (Head Office)"
        description="Create a franchise brand, set its partner revenue-share %, and create the owner's login. The owner then adds their own branches from their Head-Office console."
        actions={<NewOrgDialog />}
      />

      {orgs.length === 0 ? (
        <EmptyState icon={Building2} title="No organizations yet" description="Create one to onboard a multi-center brand." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Branches</TableHead>
                <TableHead className="text-right">Partner share</TableHead>
                <TableHead>Owner login</TableHead>
                <TableHead className={`text-right ${stickyActionsHead}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.name}
                    {!o.isActive && <Badge variant="destructive" className="ml-2">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{o.branches}</TableCell>
                  <TableCell className="text-right">{o.partnerSharePercent}%</TableCell>
                  <TableCell className="text-xs">
                    {o.adminUsername ? (
                      <span>{o.adminUsername} <span className="text-muted-foreground">({o.adminEmail})</span></span>
                    ) : (
                      <span className="text-muted-foreground">— not created —</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right ${stickyActionsCell}`}>
                    <div className="flex justify-end gap-1.5">
                      <EditOrgDialog org={o} />
                      {o.adminUsername
                        ? <ResetOwnerDialog userId={o.adminUserId!} username={o.adminUsername} />
                        : <CreateOwnerDialog org={o} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AssignBranchCard orgs={orgs} centers={centers} />
    </div>
  );
}

// ── New organization ─────────────────────────────────────────────────
function NewOrgDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => createOrganization(fd),
    undefined,
  );
  if (state?.ok && open) setOpen(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" /> New organization</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>A franchise / multi-center brand that owns several branches.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" required placeholder="e.g. BrightMinds Group" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnerSharePercent">Partner revenue-share %</Label>
              <Input id="partnerSharePercent" name="partnerSharePercent" type="number" min={0} max={100} defaultValue={20} />
              <p className="text-xs text-muted-foreground">The commission the owner earns on each branch&apos;s subscription (typical 15–30%).</p>
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Edit organization (name + share) ─────────────────────────────────
function EditOrgDialog({ org }: { org: OrgRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => updateOrganization(fd),
    undefined,
  );
  if (state?.ok && open) setOpen(false);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> Edit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {org.name}</DialogTitle>
            <DialogDescription>Update the name or partner revenue-share %.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="orgId" value={org.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`name-${org.id}`}>Organization name</Label>
              <Input id={`name-${org.id}`} name="name" defaultValue={org.name} required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`share-${org.id}`}>Partner revenue-share %</Label>
              <Input id={`share-${org.id}`} name="partnerSharePercent" type="number" min={0} max={100} defaultValue={org.partnerSharePercent} />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Create the franchise owner (org_admin) login ─────────────────────
function CreateOwnerDialog({ org }: { org: OrgRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => createOrgAdmin(fd),
    undefined,
  );
  if (state?.ok && open) setOpen(false);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><UserPlus className="size-3.5" /> Owner login</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create owner login</DialogTitle>
            <DialogDescription>The franchise owner for {org.name}. Share these credentials securely.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="orgId" value={org.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`fn-${org.id}`}>Full name</Label>
              <Input id={`fn-${org.id}`} name="fullName" placeholder="Owner name" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`un-${org.id}`}>Username</Label>
              <Input id={`un-${org.id}`} name="username" required minLength={3} placeholder="login username" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`em-${org.id}`}>Email <span className="text-muted-foreground">(optional)</span></Label>
              <Input id={`em-${org.id}`} name="email" type="email" placeholder="owner@brand.com" autoComplete="off" />
              <p className="text-xs text-muted-foreground">The username is the login. Email is just for contact — leave blank if not needed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pw-${org.id}`}>Password</Label>
              <Input id={`pw-${org.id}`} name="password" type="text" required minLength={8} placeholder="At least 8 characters" autoComplete="off" />
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

// ── Reset the franchise owner's password ─────────────────────────────
function ResetOwnerDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => resetOwnerPassword(fd),
    undefined,
  );

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><KeyRound className="size-3.5" /> Reset</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset owner password</DialogTitle>
            <DialogDescription>Set a new password for <strong>{username}</strong> (the franchise owner). Share it securely.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="userId" value={userId} />
            <div className="space-y-1.5">
              <Label htmlFor={`newpw-${userId}`}>New password</Label>
              <Input id={`newpw-${userId}`} name="newPassword" type="text" minLength={8} required placeholder="At least 8 characters" autoComplete="off" />
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

// ── Attach / detach a branch ─────────────────────────────────────────
function AssignBranchCard({ orgs, centers }: { orgs: OrgRow[]; centers: AssignCenterRow[] }) {
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => assignBranch(fd),
    undefined,
  );
  const orgName = (id: string | null) => (id ? orgs.find((o) => o.id === id)?.name ?? "—" : "— standalone —");

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-primary" /> Attach an existing center to an organization</div>
        <p className="text-sm text-muted-foreground">
          You normally won&apos;t need this — franchise owners create their own branches from their Head-Office console.
          Use this only to move an <strong>existing standalone center</strong> into a brand, or leave the organization
          blank to detach one (make it standalone again).
        </p>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-center">Center</Label>
            <select id="assign-center" name="instituteId" required className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {orgName(c.organizationId)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-org">Organization</Label>
            <select id="assign-org" name="organizationId" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">— none (standalone) —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Apply"}</Button>
          {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
          {state?.ok && <p className="w-full text-sm text-emerald-600">Updated.</p>}
        </form>
      </CardContent>
    </Card>
  );
}
