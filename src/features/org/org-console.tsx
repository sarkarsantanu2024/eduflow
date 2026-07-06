"use client";

import { useActionState, useState } from "react";
import { Building2, Users, IndianRupee, AlertCircle, LogIn, Wallet, Percent, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, stickyActionsHead, stickyActionsCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BUSINESS_TYPES } from "@/lib/constants";
import { openBranch, createBranch, type OrgOverview } from "@/features/org/actions";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const typeLabel = (t: string) => BUSINESS_TYPES.find((b) => b.value === t)?.label ?? t;

export function OrgConsole({ overview }: { overview: OrgOverview }) {
  const { org, branches, totals } = overview;

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description="Your Head-Office console — create and manage every branch in one place, and track the commission you earn on their subscriptions."
        actions={<NewBranchDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Branches" value={String(totals.branches)} />
        <Stat icon={Users} label="Students (all branches)" value={String(totals.students)} />
        <Stat icon={IndianRupee} label="Total collected" value={rupees(totals.revenue)} />
        <Stat icon={AlertCircle} label="Total pending dues" value={rupees(totals.pending)} />
      </div>

      {/* Partner revenue-share summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Wallet} label="Branch subscriptions / month" value={rupees(totals.subscriptionMonthly)} />
        <Stat icon={Percent} label="Your partner share" value={`${org.partnerSharePercent}%`} />
        <Stat
          icon={IndianRupee}
          label="Your commission / month"
          value={rupees(totals.partnerShareMonthly)}
          highlight
        />
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Create your first franchise branch with “New branch” — it comes ready with sample courses and message templates."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className={`text-right ${stickyActionsHead}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.name}
                    {!b.isActive && <Badge variant="destructive" className="ml-2">Suspended</Badge>}
                    {b.isActive && !b.onboarded && <Badge variant="warning" className="ml-2">Setup pending</Badge>}
                  </TableCell>
                  <TableCell>{typeLabel(b.type)}</TableCell>
                  <TableCell>
                    {b.plan} <span className="text-xs text-muted-foreground">({b.planStatus})</span>
                  </TableCell>
                  <TableCell className="text-right">{b.activeStudents}/{b.students}</TableCell>
                  <TableCell className="text-right">{rupees(b.revenue)}</TableCell>
                  <TableCell className="text-right">{rupees(b.pending)}</TableCell>
                  <TableCell className={`text-right ${stickyActionsCell}`}>
                    <div className="flex justify-end gap-1.5">
                      <form action={openBranch}>
                        <input type="hidden" name="instituteId" value={b.id} />
                        <Button size="sm" variant="outline" type="submit"><LogIn className="size-3.5" /> Open</Button>
                      </form>
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

function NewBranchDialog() {
  const [open, setOpen] = useState(false);
  const [addLogin, setAddLogin] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | undefined, fd: FormData) => createBranch(fd),
    undefined,
  );
  if (state?.ok && open) setOpen(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" /> New branch</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAddLogin(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New branch</DialogTitle>
            <DialogDescription>Create a franchise center under your brand. It starts on a 14-day trial with sample courses &amp; templates.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input id="branch-name" name="name" required placeholder="e.g. Bright Abacus — Salt Lake" autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch-type">Type</Label>
                <select id="branch-type" name="type" defaultValue="abacus" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {BUSINESS_TYPES.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch-city">City (optional)</Label>
                <Input id="branch-city" name="city" placeholder="City" autoComplete="off" />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm">
              <input type="checkbox" checked={addLogin} onChange={(e) => setAddLogin(e.target.checked)} />
              Create a separate branch-manager login
            </label>
            {addLogin ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mgr-name">Manager name</Label>
                  <Input id="mgr-name" name="managerFullName" placeholder="Manager name" autoComplete="off" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mgr-username">Username</Label>
                    <Input id="mgr-username" name="managerUsername" minLength={3} placeholder="login username" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mgr-email">Email <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="mgr-email" name="managerEmail" type="email" placeholder="manager@brand.com" autoComplete="off" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mgr-password">Password</Label>
                  <Input id="mgr-password" name="managerPassword" type="text" minLength={8} placeholder="At least 8 characters" autoComplete="off" />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No separate login — you&apos;ll run this branch yourself via <strong>Open</strong>.</p>
            )}

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create branch"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : undefined}>
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
