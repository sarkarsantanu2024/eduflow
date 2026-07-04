"use client";

import { useState, useEffect, useRef } from "react";
import { Package, Pencil, Trash2, MessageCircle, IndianRupee, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { WaQrDialog } from "@/features/fees/wa-qr-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, useProfile, addItem, updateItem, removeItem, newId,
  type Material, type Payment, type Expense, type Student,
} from "@/lib/store/local-db";
import { HO_MATERIALS } from "@/lib/ho-materials";
import { formatDate, formatCurrency } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/* ── Issue a material: buy from HO (cost), sell to parent with a margin ── */
function IssueMaterialDialog({
  students, onIssue,
}: {
  students: Student[];
  onIssue: (data: { student: Student; item: string; sellPrice: number; hoCost: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [pick, setPick] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [hoCost, setHoCost] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);

  const student = students.find((s) => s.id === studentId);
  const isCustom = pick === "__custom__";
  const item = isCustom ? customItem.trim() : pick;
  const margin = sellPrice - hoCost;

  function reset() { setStudentId(""); setPick(""); setCustomItem(""); setHoCost(0); setSellPrice(0); }

  function choose(name: string) {
    setPick(name);
    if (name === "__custom__" || name === "") { setHoCost(0); setSellPrice(0); setCustomItem(""); return; }
    const cost = HO_MATERIALS.find((m) => m.name === name)?.hoPrice ?? 0;
    setHoCost(cost);
    setSellPrice(cost); // default sell = cost; owner raises it to add margin
  }

  function submit() {
    if (!student || !item) { toast.error("Pick a student and an item"); return; }
    onIssue({ student, item, sellPrice, hoCost });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button><Package /> Issue material</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue material / kit</DialogTitle>
          <DialogDescription>Buy from Head Office, sell to the parent — your margin is your profit.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <select className={selectClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select a student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{`${s.firstName} ${s.lastName}`.trim()}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Material (Head Office catalogue)</Label>
            <select className={selectClass} value={pick} onChange={(e) => choose(e.target.value)}>
              <option value="">Select an item…</option>
              {HO_MATERIALS.map((m) => <option key={m.name} value={m.name}>{m.name} — HO ₹{m.hoPrice}</option>)}
              <option value="__custom__">Other / custom item…</option>
            </select>
          </div>

          {isCustom && (
            <div className="space-y-1.5">
              <Label>Item name</Label>
              <Input value={customItem} onChange={(e) => setCustomItem(e.target.value)} placeholder="Item name" />
            </div>
          )}

          {pick && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>HO price (your cost)</Label>
                  <Input type="number" value={hoCost || ""} onChange={(e) => setHoCost(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sell to parent (₹)</Label>
                  <Input type="number" value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value) || 0)} />
                </div>
              </div>
              <p className={`text-sm font-medium ${margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                Your margin: {formatCurrency(margin * 100)}
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={!student || !item}>Issue &amp; sell</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialsView() {
  const hydrated = useHydrated();
  const materials = useCollection("materials");
  const students = useCollection("students");
  const expenses = useCollection("expenses");
  const profile = useProfile();

  const biz = profile.businessName || "our institute";
  const upiId = profile.upiId;
  const qrImage = profile.qrImage;
  const today = new Date().toISOString().slice(0, 10);

  const mobileFor = (studentId: string) => {
    const s = students.find((x) => x.id === studentId);
    return s ? (s.parentMobile || s.fatherContact || "") : "";
  };

  // Buy from HO (cost → expense) and record the sale to the parent (charge).
  function onIssue({ student, item, sellPrice, hoCost }: { student: Student; item: string; sellPrice: number; hoCost: number }) {
    const name = `${student.firstName} ${student.lastName}`.trim();
    addItem<Material>("materials", {
      id: newId(), studentId: student.id, studentName: name,
      item, amount: sellPrice, issued: false, date: today,
    });
    if (hoCost > 0) {
      addItem<Expense>("expenses", {
        id: newId(), title: `Head Office — ${item} (${name})`,
        category: "Study Materials", amount: hoCost, date: today,
        note: `Cost of ${item} bought from HO for ${name}`,
      });
    }
    toast.success("Material issued", { description: `${item} → ${name} · margin ${formatCurrency((sellPrice - hoCost) * 100)}` });
  }

  // Record the sale charge as collected and log it in payment history (like fees).
  // `issued` is reused to mean "charge paid".
  function collect(m: Material) {
    updateItem<Material>("materials", m.id, { issued: true });
    addItem<Payment>("payments", {
      id: newId(), studentId: m.studentId, studentName: m.studentName,
      amount: m.amount, method: "upi", status: "success", source: "material", date: today,
    });
    toast.success(`Collected ${formatCurrency(m.amount * 100)}`, { description: `${m.studentName} · ${m.item}` });
  }

  // Deleting a material also removes the Head Office cost expense it posted, so
  // the ledger doesn't keep an orphan cost for a kit that no longer exists.
  function deleteMaterial(m: Material) {
    removeItem("materials", m.id);
    const costTitle = `Head Office — ${m.item} (${m.studentName})`;
    const linked = expenses.find((e) => e.title === costTitle);
    if (linked) removeItem("expenses", linked.id);
    toast.success("Material deleted");
  }

  // One-time cleanup: older builds didn't remove a material's Head Office cost
  // when the material was deleted, leaving orphan "Study Materials" expenses that
  // dented Net Profit. Sweep them once per session — an expense is an orphan if
  // it's a HO material cost whose material record no longer exists.
  const swept = useRef(false);
  useEffect(() => {
    if (!hydrated || swept.current) return;
    swept.current = true;
    const validCostTitles = new Set(materials.map((m) => `Head Office — ${m.item} (${m.studentName})`));
    expenses
      .filter((e) => e.category === "Study Materials" && e.title.startsWith("Head Office — ") && !validCostTitles.has(e.title))
      .forEach((e) => removeItem("expenses", e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const issueBtn = <IssueMaterialDialog students={students} onIssue={onIssue} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Materials & Kits" description="Buy kits/books from Head Office and sell to students with your margin — collect the charge like fees." actions={issueBtn} />

      {!hydrated ? null : materials.length === 0 ? (
        <EmptyState
          icon={Package} title="No materials yet"
          description="Issue a kit or book from the Head Office catalogue and sell it to a student."
          action={<div className="flex gap-2">{issueBtn}</div>}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead><TableHead>Item</TableHead><TableHead>Sell price</TableHead>
                <TableHead>Date</TableHead><TableHead>Payment</TableHead>
                <TableHead className={`text-right ${stickyActionsHead}`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => {
                const mobile = mobileFor(m.studentId);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.studentName}</TableCell>
                    <TableCell>{m.item}</TableCell>
                    <TableCell>{m.amount ? formatCurrency(m.amount * 100) : <span className="text-muted-foreground">Free</span>}</TableCell>
                    <TableCell>{m.date ? formatDate(m.date) : "—"}</TableCell>
                    <TableCell>
                      {m.amount === 0 ? (
                        <Badge variant="secondary">Free</Badge>
                      ) : m.issued ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Paid
                        </span>
                      ) : (
                        <div className="flex gap-1.5">
                          <WaQrDialog
                            title="Send material charge reminder" recipientName={m.studentName} mobile={mobile}
                            amount={m.amount} upiId={upiId} qrImage={qrImage} payeeName={biz} note={m.item}
                            message={`Dear Parent, a charge of ₹${m.amount} for ${m.item} (${m.studentName}) is pending. Kindly pay ${upiId ? `via UPI to ${upiId}` : "using the payment QR shared with you"} at your convenience. Thank you. — ${biz}`}
                            onSent={() => toast.success("Reminder opened in WhatsApp")}
                            action={{ label: "Mark as paid", icon: <IndianRupee />, onClick: () => collect(m) }}
                            trigger={<Button size="sm" variant="outline"><MessageCircle /> Reminder</Button>}
                          />
                          <Button size="sm" onClick={() => collect(m)}><IndianRupee /> Collect</Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${stickyActionsCell}`}>
                      <div className="flex justify-end gap-1">
                        <FormDialog
                          title="Edit material" submitLabel="Save changes" successMessage="Material updated"
                          trigger={<Button size="icon" variant="ghost" aria-label="Edit"><Pencil /></Button>}
                          fields={[
                            { name: "item", label: "Item", required: true, defaultValue: m.item },
                            { name: "amount", label: "Sell price (₹)", type: "number", defaultValue: String(m.amount) },
                          ]}
                          onSubmit={(v) => updateItem<Material>("materials", m.id, { item: v("item"), amount: Number(v("amount")) || 0 })}
                        />
                        <ConfirmDialog
                          title={`Delete "${m.item}"?`}
                          description={`Moves the ${m.item} record for ${m.studentName} and its Head Office cost to Trash — both can be restored anytime.`}
                          confirmLabel="Delete" destructive
                          onConfirm={() => deleteMaterial(m)}
                          trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                        />
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
