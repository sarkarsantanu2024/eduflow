"use client";

import { useEffect, useRef, useState } from "react";
import {
  Receipt, MessageCircle, IndianRupee, BadgeCheck, FileText, CheckCircle2, CalendarClock, History, ListTree, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ExportData } from "@/components/export-data";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { WaQrDialog, upiQrUrl } from "@/features/fees/wa-qr-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, removeItem, setProfile, newId,
  reloadDb,
  type Fee, type Payment, type Student, type Material, type RecurringCharge,
} from "@/lib/store/local-db";
import { ensureMonthlyBilling } from "@/features/automation/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { todayIso } from "@/lib/date";
import { allocatePayment, reverseAllocation } from "@/lib/money";
import { useCanManage } from "@/components/layout/role-context";

const periodLabel = (period: string) =>
  period ? new Date(`${period}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "numeric" }) : "—";

// Service rules: after this many unpaid months a student is auto-deactivated;
// a reactivation fee (set per center in Profile) resumes service.
const DEACTIVATE_AFTER = 4;
const DEFAULT_REACTIVATION_FEE = 700;

type Tab = "monthly" | "other" | "history";

const statusVariant: Record<Fee["status"], "success" | "warning" | "secondary" | "destructive"> = {
  paid: "success", partial: "warning", pending: "secondary", overdue: "destructive",
};

export function FeesView() {
  const hydrated = useHydrated();
  const fees = useCollection("fees");
  const students = useCollection("students");
  const payments = useCollection("payments");
  const expenses = useCollection("expenses");
  const teachers = useCollection("teachers");
  const materials = useCollection("materials");
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>("monthly");
  const canManage = useCanManage();

  const today = todayIso();
  const ym = today.slice(0, 7); // current period "YYYY-MM"
  const monthLabel = new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const biz = profile.businessName || "Your institute";
  const upiId = profile.upiId;
  const qrImage = profile.qrImage;
  const reactivationFee = profile.reactivationFee || DEFAULT_REACTIVATION_FEE;

  const monthlyFees = fees.filter((f) => f.kind === "monthly");
  const otherFees = fees.filter((f) => f.kind === "other");

  // ── totals ──────────────────────────────────────────────────
  const billed = fees.reduce((s, f) => s + f.amount, 0);
  const collected = fees.reduce((s, f) => s + f.amountPaid, 0);

  // ── shared mutations ────────────────────────────────────────
  // Applies `amount` across the given fees, oldest first (supports partial pay).
  function applyPayment(list: Fee[], amount: number, studentId: string, studentName: string, method: Payment["method"] = "upi") {
    // Deciding WHICH fee the money clears lives in lib/money.ts so it can be
    // tested without a browser. This just applies the decision.
    const { allocations, collected } = allocatePayment(list, amount);
    allocations.forEach((a) => updateItem<Fee>("fees", a.id, { amountPaid: a.amountPaid, status: a.status }));
    if (collected > 0) {
      addItem<Payment>("payments", { id: newId("pay"), studentId, studentName, amount: collected, method, status: "success", source: "fee", date: today });
      toast.success(`Collected ${formatCurrency(collected * 100)}`, { description: `${studentName} · recorded in History` });
    }
  }

  // Collect the center's reactivation fee and resume service (dues are cleared first).
  function reactivate(student: Student) {
    const name = `${student.firstName} ${student.lastName}`.trim();
    addItem<Payment>("payments", { id: newId("pay"), studentId: student.id, studentName: name, amount: reactivationFee, method: "upi", status: "success", source: "reactivation", date: today });
    updateItem<Student>("students", student.id, { status: "active" });
    toast.success(`${name} reactivated`, { description: `₹${reactivationFee} reactivation fee collected` });
  }

  // Undo a recorded collection (e.g. a test entry or a mistaken tap). Removes the
  // payment AND rolls back exactly what it collected, using the payment's source
  // so a material reversal never touches fees (and vice-versa) — keeping the Fees
  // "Collected" total and the Dashboard (which sums payments) in agreement.
  function reversePayment(p: Payment) {
    if (p.source === "material") {
      // Un-collect the matching material charge — leave fees alone.
      const m = materials.find((x) => x.studentId === p.studentId && x.amount === p.amount && x.issued);
      if (m) updateItem<Material>("materials", m.id, { issued: false });
    } else if (p.source === "fee") {
      // Mirrors allocatePayment newest-paid-first, so reversing a collection
      // restores exactly the fees it cleared. See lib/money.ts.
      const paidFees = fees.filter((f) => f.studentId === p.studentId);
      reverseAllocation(paidFees, p.amount).allocations.forEach((a) =>
        updateItem<Fee>("fees", a.id, { amountPaid: a.amountPaid, status: a.status }),
      );
    }
    // "reactivation" (and any legacy/unknown source) → just remove the payment.
    removeItem("payments", p.id);
    toast.success(`Reversed ${formatCurrency(p.amount * 100)}`, { description: `${p.studentName} · collection undone` });
  }

  function markReminder(list: Fee[]) {
    list.forEach((f) => updateItem<Fee>("fees", f.id, { reminderSentAt: today }));
    toast.success("Reminder sent on WhatsApp", { description: "Demo — preview only" });
  }

  // Auto-deactivation moved SERVER-SIDE — see features/automation/billing.ts.
  //
  // It used to run right here, in a browser effect, which meant a student was
  // suspended at the arbitrary moment somebody happened to open this page, and
  // it counted every unpaid monthly fee ever recorded — including months
  // before the centre started billing them, so entering a long-standing
  // student could suspend them on sight.

  // ── monthly billing ──
  // Fees, recurring charges and teacher salary are generated SERVER-SIDE (see
  // features/automation/billing.ts) and are idempotent at the database level.
  // They used to be three useEffect hooks right here, deduping against this
  // browser's cached copy of the data — so two tabs open at once produced two
  // real charges against the same parent, and a month where nobody opened this
  // page produced no fees at all.
  //
  // The daily cron already does this for every center; this call just means a
  // brand-new center sees its fees immediately instead of tomorrow.
  const billingRequested = useRef(false);
  useEffect(() => {
    if (!hydrated || billingRequested.current) return;
    billingRequested.current = true;
    ensureMonthlyBilling()
      .then((r) => { if (r.feesCreated || r.expensesCreated) reloadDb(); })
      .catch(() => { /* cron will catch it tonight — never block the page */ });
  }, [hydrated]);

  // One-time: fold the legacy royalty % into the generic recurring charges.
  // Owner-only: this writes the centre profile, which staff cannot do. Without
  // the guard a teacher opening Fees triggered a write the server refuses, and
  // got an error toast for simply visiting the page.
  const royaltyMigrated = useRef(false);
  useEffect(() => {
    if (!hydrated || royaltyMigrated.current || !canManage) return;
    royaltyMigrated.current = true;
    const pct = profile.hoRoyaltyPercent || 0;
    const charges = profile.recurringCharges || [];
    if (pct > 0 && !charges.some((c) => c.name === "Head Office royalty")) {
      const royalty: RecurringCharge = { id: newId(), name: "Head Office royalty", basis: "percent", amount: pct, category: "Head Office" };
      setProfile({ hoRoyaltyPercent: 0, recurringCharges: [...charges, royalty] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (hydrated && fees.length === 0 && students.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fees" description="Collect monthly fees, raise other charges, and track payments." />
        <EmptyState
          icon={Receipt} title="No data yet"
          description="Add students and they'll appear here for monthly fees and charges."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fees" description="Collect monthly fees, raise other charges, and track payments."
        actions={<ExportData filename="fees" rows={fees} columns={[
          { header: "Student", value: (f) => f.studentName },
          { header: "Kind", value: (f) => f.kind },
          { header: "Period", value: (f) => (f.period ? periodLabel(f.period) : "") },
          { header: "Title", value: (f) => f.title },
          { header: "Amount (₹)", value: (f) => f.amount },
          { header: "Paid (₹)", value: (f) => f.amountPaid },
          { header: "Status", value: (f) => f.status },
          { header: "Due date", value: (f) => f.dueDate },
        ]} />} />

      {/* summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {([["Total Billed", billed], ["Collected", collected], ["Pending", billed - collected]] as const).map(([label, val]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(val * 100)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* tabs */}
      <div className="inline-grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        <TabBtn active={tab === "monthly"} onClick={() => setTab("monthly")} icon={CalendarClock}>Monthly</TabBtn>
        <TabBtn active={tab === "other"} onClick={() => setTab("other")} icon={Receipt}>Other fees</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={History}>History</TabBtn>
      </div>

      {tab === "monthly" && (
        <MonthlyTab
          students={students} monthlyFees={monthlyFees} ym={ym}
          biz={biz} upiId={upiId} qrImage={qrImage} reactivationFee={reactivationFee}
          onReminder={markReminder} onCollect={applyPayment} onReactivate={reactivate}
        />
      )}

      {tab === "other" && (
        <OtherTab
          students={students} otherFees={otherFees} today={today} biz={biz} upiId={upiId} qrImage={qrImage}
          onReminder={markReminder} onCollect={applyPayment}
        />
      )}

      {tab === "history" && <HistoryTab payments={payments} onReverse={reversePayment} />}
    </div>
  );
}

/* ── Monthly tab — per-student outstanding, arrears, partial pay & reactivation ── */
function MonthlyTab({
  students, monthlyFees, ym, biz, upiId, qrImage, reactivationFee,
  onReminder, onCollect, onReactivate,
}: {
  students: Student[];
  monthlyFees: Fee[];
  ym: string; biz: string; upiId: string; qrImage: string; reactivationFee: number;
  onReminder: (list: Fee[]) => void;
  onCollect: (list: Fee[], amount: number, studentId: string, studentName: string) => void;
  onReactivate: (s: Student) => void;
}) {
  // Month filter: "all" shows total dues across every month; a specific period
  // narrows every row to just that month's fee.
  const [period, setPeriod] = useState<string>("all");
  const availablePeriods = Array.from(new Set([ym, ...monthlyFees.map((f) => f.period)]))
    .filter(Boolean)
    .sort()
    .reverse();

  const rows = students
    .filter((s) => s.status === "active" || monthlyFees.some((f) => f.studentId === s.id))
    .map((s) => {
      const name = `${s.firstName} ${s.lastName}`.trim();
      const mine = monthlyFees.filter((f) => f.studentId === s.id);
      // Which fees this row acts on, based on the filter.
      const scope = period === "all" ? mine : mine.filter((f) => f.period === period);
      const shownFee = period === "all" ? mine.find((f) => f.period === ym) : scope[0];
      const unpaid = scope.filter((f) => f.status !== "paid");
      const outstanding = unpaid.reduce((a, f) => a + (f.amount - f.amountPaid), 0);
      return {
        s, name, mine, mobile: s.parentMobile || s.fatherContact,
        shownFee, unpaid, monthsPending: unpaid.length, outstanding, inactive: s.status === "inactive",
      };
    })
    // In a specific month, hide students who have no fee for that month at all.
    .filter((r) => period === "all" || r.shownFee || r.inactive);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          This month&apos;s fee is added automatically for every active student. After {DEACTIVATE_AFTER} unpaid months service pauses; ₹{reactivationFee} resumes it.
        </p>
        <select
          aria-label="Filter by month"
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All months (total dues)</option>
          {availablePeriods.map((p) => (
            <option key={p} value={p}>{periodLabel(p)}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>{period === "all" ? "This month" : "Status"}</TableHead>
              <TableHead>Months pending</TableHead><TableHead>Outstanding</TableHead>
              <TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No students.</TableCell></TableRow>
            )}
            {rows.map(({ s, name, mine, mobile, shownFee, unpaid, monthsPending, outstanding, inactive }) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <MonthsDialog
                    name={name} fees={mine} onPay={(f) => onCollect([f], f.amount - f.amountPaid, s.id, name)}
                    trigger={
                      <button className="inline-flex items-center gap-1 hover:underline">
                        {name} <ListTree className="size-3.5 text-muted-foreground" />
                      </button>
                    }
                  />
                </TableCell>
                <TableCell>
                  {inactive
                    ? <Badge variant="destructive">inactive</Badge>
                    : shownFee
                      ? <Badge variant={statusVariant[shownFee.status]}>{shownFee.status}</Badge>
                      : <span className="text-xs text-muted-foreground">Not generated</span>}
                </TableCell>
                <TableCell>{monthsPending > 0 ? `${monthsPending} month${monthsPending > 1 ? "s" : ""}` : "—"}</TableCell>
                <TableCell className="font-semibold">
                  {outstanding > 0
                    ? formatCurrency(outstanding * 100)
                    : inactive
                      ? <span className="text-xs font-normal text-muted-foreground">₹{reactivationFee} to resume</span>
                      : "—"}
                </TableCell>
                <TableCell className={`text-right ${stickyActionsCell}`}>
                  {outstanding > 0 ? (
                    // Dues pending (active or paused) — collect them first.
                    <div className="flex justify-end gap-1.5">
                      <WaQrDialog
                        title="Send fee reminder" recipientName={name} mobile={mobile}
                        amount={outstanding} upiId={upiId} qrImage={qrImage} payeeName={biz} note={`${name} monthly fee`}
                        message={`Dear Parent, greetings from ${biz}. This is a gentle reminder that ${name}'s fee of ₹${outstanding} for ${unpaid.map((f) => periodLabel(f.period)).join(", ")} is currently pending. Kindly pay at your convenience ${upiId ? `via UPI to ${upiId}` : "using the payment QR shared with you"}. Thank you very much — please ignore this message if you have already paid.`}
                        onSent={() => onReminder(unpaid)}
                        trigger={<Button size="sm" variant="outline"><MessageCircle /> Reminder</Button>}
                      />
                      <MonthlyCollectDialog
                        name={name} mobile={mobile} outstanding={outstanding} biz={biz} upiId={upiId} qrImage={qrImage}
                        onPay={(amount) => onCollect(unpaid, amount, s.id, name)}
                        trigger={<Button size="sm"><IndianRupee /> Collect</Button>}
                      />
                    </div>
                  ) : inactive ? (
                    // Dues cleared but still paused — collect the reactivation fee.
                    <div className="flex justify-end gap-1.5">
                      <WaQrDialog
                        title="Reactivation reminder" recipientName={name} mobile={mobile}
                        amount={reactivationFee} upiId={upiId} qrImage={qrImage} payeeName={biz} note={`${name} reactivation`}
                        message={`Dear Parent, greetings from ${biz}. ${name}'s classes are currently paused due to pending dues. Kindly pay the reactivation fee of ₹${reactivationFee} ${upiId ? `via UPI to ${upiId}` : "using the payment QR shared with you"} to resume classes. Thank you for your understanding.`}
                        onSent={() => toast.success("Reactivation reminder sent on WhatsApp", { description: "Demo — preview only" })}
                        trigger={<Button size="sm" variant="outline"><MessageCircle /> Reminder</Button>}
                      />
                      <WaQrDialog
                        title="Collect reactivation fee" recipientName={name} mobile={mobile}
                        amount={reactivationFee} upiId={upiId} qrImage={qrImage} payeeName={biz} note={`${name} reactivation`}
                        message={`Dear Parent, kindly pay the reactivation fee of ₹${reactivationFee} for ${name} ${upiId ? `via UPI to ${upiId}` : "using the QR shared with you"} to resume classes. Thank you. — ${biz}`}
                        action={{ label: `Collect ₹${reactivationFee} & reactivate`, icon: <RotateCcw />, onClick: () => onReactivate(s) }}
                        trigger={<Button size="sm"><RotateCcw /> Reactivate ₹{reactivationFee}</Button>}
                      />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> All clear
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ── Collect monthly fee — supports partial payment (oldest months first) ── */
function MonthlyCollectDialog({
  name, mobile, outstanding, biz, upiId, qrImage, onPay, trigger,
}: {
  name: string; mobile: string; outstanding: number; biz: string; upiId: string; qrImage: string;
  onPay: (amount: number) => void; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding);
  const amt = Math.max(0, Math.min(amount, outstanding));
  // Prefer the center's uploaded QR; otherwise build a UPI QR for this exact amount.
  const qrSrc = qrImage || (upiId ? upiQrUrl(upiId, biz, amt, `${name} monthly fee`) : "");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setAmount(outstanding); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect monthly fee</DialogTitle>
          <DialogDescription>{name} · WhatsApp {mobile}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-semibold">{formatCurrency(outstanding * 100)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collect-amt">Amount to collect (₹)</Label>
            <Input id="collect-amt" type="number" min={1} max={outstanding} value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">Partial payments allowed (up to {DEACTIVATE_AFTER} months). Applied to the oldest unpaid months first.</p>
          </div>
          {amt > 0 && qrSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="flex flex-col items-center gap-2">
              <img src={qrSrc} alt="Payment QR" className="size-40 rounded-lg border bg-white object-contain" />
              <p className="text-xs text-muted-foreground">Scan to pay {formatCurrency(amt * 100)}{upiId && ` · ${upiId}`}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          <Button disabled={amt <= 0} onClick={() => { onPay(amt); setOpen(false); }}><IndianRupee /> Mark as paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Other fees / expenses — create → QR → collect → approve → voucher ── */
function OtherTab({
  students, otherFees, today, biz, upiId, qrImage, onReminder, onCollect,
}: {
  students: Student[];
  otherFees: Fee[];
  today: string; biz: string; upiId: string; qrImage: string;
  onReminder: (list: Fee[]) => void;
  onCollect: (list: Fee[], amount: number, studentId: string, studentName: string) => void;
}) {
  const createBtn = (
    <FormDialog
      title="Create fee / expense" submitLabel="Create & send QR" successMessage="Fee created · QR sent on WhatsApp"
      trigger={<Button><Receipt /> Create fee</Button>}
      fields={[
        { name: "studentId", label: "Student", type: "select", required: true,
          options: students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })) },
        { name: "title", label: "Title", required: true, placeholder: "Exam fee / Workbook / Kit" },
        { name: "amount", label: "Amount (₹)", type: "number", required: true },
        { name: "dueDate", label: "Due date", type: "date" },
      ]}
      onSubmit={(v) => {
        const s = students.find((x) => x.id === v("studentId"));
        const name = s ? `${s.firstName} ${s.lastName}`.trim() : "";
        addItem<Fee>("fees", {
          id: newId("fee"), studentId: v("studentId"), studentName: name,
          parentMobile: s?.parentMobile || s?.fatherContact || "", kind: "other", period: "",
          title: v("title"), type: "other", amount: Number(v("amount")) || 0, amountPaid: 0,
          status: "pending", dueDate: v("dueDate"), reminderSentAt: today, approved: false, voucherSentAt: "",
        });
      }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          One-off charges (exam fee, books, kit…). On create, a QR + details are sent to the parent. After payment & your approval, a voucher is sent.
        </p>
        {createBtn}
      </div>

      {otherFees.length === 0 ? (
        <EmptyState icon={Receipt} title="No other fees yet" description="Create an exam fee, book charge or any one-off expense." action={createBtn} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead><TableHead>Title</TableHead><TableHead>Amount</TableHead>
                <TableHead>Progress</TableHead><TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otherFees.map((f) => {
                const due = f.amount - f.amountPaid;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.studentName}</TableCell>
                    <TableCell>{f.title}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(f.amount * 100)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.reminderSentAt && <Chip>QR sent</Chip>}
                        {f.status === "paid" && <Chip tone="green">Paid</Chip>}
                        {f.approved && <Chip tone="green">Approved</Chip>}
                        {f.voucherSentAt && <Chip tone="green">Voucher sent</Chip>}
                        {!f.reminderSentAt && f.status !== "paid" && <Badge variant={statusVariant[f.status]}>{f.status}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${stickyActionsCell}`}>
                      <div className="flex justify-end gap-1.5">
                        {f.status !== "paid" && (
                          <>
                            <WaQrDialog
                              title="Send fee QR" recipientName={f.studentName} mobile={f.parentMobile}
                              amount={due} upiId={upiId} qrImage={qrImage} payeeName={biz} note={f.title}
                              message={`Dear Parent, greetings from ${biz}. A ${f.title} charge of ₹${due} for ${f.studentName}${f.dueDate ? ` (due ${f.dueDate})` : ""} is pending. Kindly pay ${upiId ? `via UPI to ${upiId}` : "using the payment QR shared with you"} at your convenience. Thank you.`}
                              onSent={() => onReminder([f])}
                              trigger={<Button size="sm" variant="outline"><MessageCircle /> QR</Button>}
                            />
                            <WaQrDialog
                              title="Collect fee" recipientName={f.studentName} mobile={f.parentMobile}
                              amount={due} upiId={upiId} qrImage={qrImage} payeeName={biz} note={f.title}
                              message={`Dear Parent, a payment of ₹${due} for ${f.title} (${f.studentName}) is requested. Kindly pay ${upiId ? `via UPI to ${upiId}` : "using the QR shared with you"}. Thank you.`}
                              action={{ label: "Mark as paid", icon: <IndianRupee />, onClick: () => onCollect([f], due, f.studentId, f.studentName) }}
                              trigger={<Button size="sm"><IndianRupee /> Collect</Button>}
                            />
                          </>
                        )}
                        {f.status === "paid" && !f.approved && (
                          <Button size="sm" variant="outline"
                            onClick={() => { updateItem<Fee>("fees", f.id, { approved: true }); toast.success("Approved — you can now send the voucher"); }}>
                            <BadgeCheck /> Approve
                          </Button>
                        )}
                        {f.status === "paid" && f.approved && !f.voucherSentAt && (
                          <WaQrDialog
                            title="Send expense voucher" recipientName={f.studentName} mobile={f.parentMobile}
                            message={`Payment received — ₹${f.amount} for ${f.title} (${f.studentName}) on ${formatDate(today)}. This message is your official receipt/voucher. Thank you! — ${biz}`}
                            onSent={() => { updateItem<Fee>("fees", f.id, { voucherSentAt: today }); toast.success("Voucher sent on WhatsApp"); }}
                            trigger={<Button size="sm" variant="outline"><FileText /> Send voucher</Button>}
                          />
                        )}
                        {f.status === "paid" && f.approved && f.voucherSentAt && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="size-3.5" /> Done
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ── Collection history (replaces the old Payments page) ──────── */
function HistoryTab({ payments, onReverse }: { payments: Payment[]; onReverse: (p: Payment) => void }) {
  if (payments.length === 0) {
    return <EmptyState icon={History} title="No payments yet" description="Collected payments from the Monthly and Other tabs appear here." />;
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportData filename="payments" rows={payments} columns={[
          { header: "Student", value: (p) => p.studentName },
          { header: "Amount (₹)", value: (p) => p.amount },
          { header: "Method", value: (p) => p.method },
          { header: "For", value: (p) => p.source },
          { header: "Status", value: (p) => p.status },
          { header: "Date", value: (p) => p.date },
        ]} />
      </div>
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead><TableHead>Amount</TableHead>
            <TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
            <TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.studentName}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(p.amount * 100)}</TableCell>
              <TableCell className="uppercase">{p.method}</TableCell>
              <TableCell>{p.date ? formatDate(p.date) : "—"}</TableCell>
              <TableCell><Badge variant={p.status === "success" ? "success" : "warning"}>{p.status}</Badge></TableCell>
              <TableCell className={`text-right ${stickyActionsCell}`}>
                <ConfirmDialog
                  title={`Reverse ${formatCurrency(p.amount * 100)} from ${p.studentName}?`}
                  description="Removes this collection and rolls back the fee it paid. Use this for a test entry or a payment recorded by mistake."
                  confirmLabel="Reverse" destructive
                  onConfirm={() => onReverse(p)}
                  trigger={<Button size="icon" variant="ghost" aria-label="Reverse payment" title="Reverse this collection"><RotateCcw className="text-destructive" /></Button>}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
    </div>
  );
}

/* ── per-student month-by-month detail (arrears + edit amount) ── */
function MonthsDialog({
  name, fees, onPay, trigger,
}: { name: string; fees: Fee[]; onPay: (f: Fee) => void; trigger: React.ReactNode }) {
  const sorted = [...fees].sort((a, b) => a.period.localeCompare(b.period));
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{name} — monthly fees</DialogTitle>
          <DialogDescription>Every month&apos;s status. Edit an amount, or mark a month paid.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">No monthly fees yet.</p>}
          {sorted.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-lg border p-2">
              <span className="w-20 text-sm font-medium">{periodLabel(f.period)}</span>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">₹</span>
                <Input
                  type="number" defaultValue={f.amount} disabled={f.status === "paid"} className="h-8 w-20"
                  onBlur={(e) => {
                    const v = Number(e.target.value) || 0;
                    if (v !== f.amount) { updateItem<Fee>("fees", f.id, { amount: v }); toast.success("Amount updated"); }
                  }}
                />
              </div>
              <Badge variant={statusVariant[f.status]}>{f.status}</Badge>
              {f.status !== "paid" ? (
                <Button size="sm" className="ml-auto" onClick={() => onPay(f)}><IndianRupee /> Pay</Button>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Paid
                </span>
              )}
            </div>
          ))}
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── small UI helpers ─────────────────────────────────────────── */
function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Receipt; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "green" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
      tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
    }`}>
      {tone === "green" && <CheckCircle2 className="size-3" />}{children}
    </span>
  );
}
