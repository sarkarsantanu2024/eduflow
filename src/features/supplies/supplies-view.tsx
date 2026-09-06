"use client";

import { useState } from "react";
import { Megaphone, Boxes, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ExportData } from "@/components/export-data";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  stickyActionsHead, stickyActionsCell,
} from "@/components/ui/table";
import {
  useCollection, useHydrated, addItem, removeItem, newId,
  type AdMaterial, type Stationery,
} from "@/lib/store/local-db";
import { formatDate } from "@/lib/utils";
import { todayIso } from "@/lib/date";

const textareaClass =
  "min-h-20 w-full rounded-lg border border-input bg-card p-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Megaphone; children: React.ReactNode }) {
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

/* ── Ad material entry + records ─────────────────────────────────── */
type AdKey = "banner" | "leaflet" | "sunPack" | "poster" | "voice";
const AD_FIELDS: { key: AdKey; label: string }[] = [
  { key: "banner", label: "Banner" },
  { key: "leaflet", label: "Leaflet" },
  { key: "sunPack", label: "Sun Pack" },
  { key: "poster", label: "Poster" },
  { key: "voice", label: "Voice" },
];
const EMPTY_AD = { banner: "", leaflet: "", sunPack: "", poster: "", voice: "", other: "" };

function AdTab({ addedBy, hydrated }: { addedBy: string; hydrated: boolean }) {
  const rows = useCollection("adMaterials");
  const [form, setForm] = useState<Record<AdKey, string> & { other: string }>(EMPTY_AD);
  const num = (v: string) => Number(v) || 0;

  function save() {
    const anyQty = AD_FIELDS.some((f) => num(form[f.key]) > 0);
    if (!anyQty && !form.other.trim()) { toast.error("Enter at least one item or a note"); return; }
    addItem<AdMaterial>("adMaterials", {
      id: newId(), date: todayIso(),
      banner: num(form.banner), leaflet: num(form.leaflet), sunPack: num(form.sunPack),
      poster: num(form.poster), voice: num(form.voice), other: form.other.trim(), addedBy,
    });
    setForm(EMPTY_AD);
    toast.success("Ad material entry saved");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AD_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type="number" min={0} value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder="Qty" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Other</Label>
            <textarea className={textareaClass} value={form.other}
              onChange={(e) => setForm((p) => ({ ...p, other: e.target.value }))} placeholder="Anything else…" />
          </div>
          <div className="space-y-1.5">
            <Label>Added by</Label>
            <Input value={addedBy} readOnly className="cursor-not-allowed bg-muted/50" />
          </div>
          <Button onClick={save}><Plus /> Save entry</Button>
        </CardContent>
      </Card>

      {!hydrated ? null : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="No ad-material entries yet" description="Log banners, leaflets, posters and more as you receive or print them." />
      ) : (
        <>
        <div className="flex justify-end">
          <ExportData filename="ad-materials" rows={rows} columns={[
            { header: "Date", value: (r) => r.date },
            { header: "Banner", value: (r) => r.banner || 0 },
            { header: "Leaflet", value: (r) => r.leaflet || 0 },
            { header: "Sun Pack", value: (r) => r.sunPack || 0 },
            { header: "Poster", value: (r) => r.poster || 0 },
            { header: "Voice", value: (r) => r.voice || 0 },
            { header: "Other", value: (r) => r.other },
            { header: "Added by", value: (r) => r.addedBy },
          ]} />
        </div>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Banner</TableHead><TableHead>Leaflet</TableHead>
                <TableHead>Sun Pack</TableHead><TableHead>Poster</TableHead><TableHead>Voice</TableHead>
                <TableHead>Other</TableHead><TableHead>Added by</TableHead>
                <TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date ? formatDate(r.date) : "—"}</TableCell>
                  <TableCell>{r.banner || "—"}</TableCell>
                  <TableCell>{r.leaflet || "—"}</TableCell>
                  <TableCell>{r.sunPack || "—"}</TableCell>
                  <TableCell>{r.poster || "—"}</TableCell>
                  <TableCell>{r.voice || "—"}</TableCell>
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground" title={r.other}>{r.other || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.addedBy || "—"}</TableCell>
                  <TableCell className={`text-right ${stickyActionsCell}`}>
                    <ConfirmDialog
                      title="Delete this entry?" confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("adMaterials", r.id); toast.success("Entry deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        </>
      )}
    </div>
  );
}

/* ── Stationery entry + records ──────────────────────────────────── */
const EMPTY_ST = { stationery: "", gift: "", other: "" };

function StationeryTab({ addedBy, hydrated }: { addedBy: string; hydrated: boolean }) {
  const rows = useCollection("stationery");
  const [form, setForm] = useState<typeof EMPTY_ST>(EMPTY_ST);
  const num = (v: string) => Number(v) || 0;

  function save() {
    if (num(form.stationery) <= 0 && num(form.gift) <= 0 && !form.other.trim()) {
      toast.error("Enter at least one item or a note");
      return;
    }
    addItem<Stationery>("stationery", {
      id: newId(), date: todayIso(),
      stationery: num(form.stationery), gift: num(form.gift), other: form.other.trim(), addedBy,
    });
    setForm(EMPTY_ST);
    toast.success("Stationery entry saved");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Stationery</Label>
              <Input type="number" min={0} value={form.stationery}
                onChange={(e) => setForm((p) => ({ ...p, stationery: e.target.value }))} placeholder="Qty" />
            </div>
            <div className="space-y-1.5">
              <Label>Gift</Label>
              <Input type="number" min={0} value={form.gift}
                onChange={(e) => setForm((p) => ({ ...p, gift: e.target.value }))} placeholder="Qty" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Other</Label>
            <textarea className={textareaClass} value={form.other}
              onChange={(e) => setForm((p) => ({ ...p, other: e.target.value }))} placeholder="Anything else…" />
          </div>
          <div className="space-y-1.5">
            <Label>Added by</Label>
            <Input value={addedBy} readOnly className="cursor-not-allowed bg-muted/50" />
          </div>
          <Button onClick={save}><Plus /> Save entry</Button>
        </CardContent>
      </Card>

      {!hydrated ? null : rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No stationery entries yet" description="Log stationery and gifts as you receive them." />
      ) : (
        <>
        <div className="flex justify-end">
          <ExportData filename="stationery" rows={rows} columns={[
            { header: "Date", value: (r) => r.date },
            { header: "Stationery", value: (r) => r.stationery || 0 },
            { header: "Gift", value: (r) => r.gift || 0 },
            { header: "Other", value: (r) => r.other },
            { header: "Added by", value: (r) => r.addedBy },
          ]} />
        </div>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Stationery</TableHead><TableHead>Gift</TableHead>
                <TableHead>Other</TableHead><TableHead>Added by</TableHead>
                <TableHead className={`text-right ${stickyActionsHead}`}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date ? formatDate(r.date) : "—"}</TableCell>
                  <TableCell>{r.stationery || "—"}</TableCell>
                  <TableCell>{r.gift || "—"}</TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground" title={r.other}>{r.other || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.addedBy || "—"}</TableCell>
                  <TableCell className={`text-right ${stickyActionsCell}`}>
                    <ConfirmDialog
                      title="Delete this entry?" confirmLabel="Delete" destructive
                      onConfirm={() => { removeItem("stationery", r.id); toast.success("Entry deleted"); }}
                      trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="text-destructive" /></Button>}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        </>
      )}
    </div>
  );
}

export function SuppliesView({ addedBy }: { addedBy: string }) {
  const hydrated = useHydrated();
  const [tab, setTab] = useState<"ad" | "stationery">("ad");

  return (
    <div className="space-y-6">
      <PageHeader title="Ad & Stationery" description="Log the advertising materials and stationery your centre receives or prints." />

      <div className="inline-grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <TabBtn active={tab === "ad"} onClick={() => setTab("ad")} icon={Megaphone}>Ad materials</TabBtn>
        <TabBtn active={tab === "stationery"} onClick={() => setTab("stationery")} icon={Boxes}>Stationery</TabBtn>
      </div>

      {tab === "ad" ? <AdTab addedBy={addedBy} hydrated={hydrated} /> : <StationeryTab addedBy={addedBy} hydrated={hydrated} />}
    </div>
  );
}
