"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IdCard,
  Search,
  Camera,
  Settings2,
  Upload,
  X,
  Download,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  downloadIdCardsPdf,
  previewIdCardHtml,
  CARD_BG_PRESETS,
  MAX_CARDS_PER_PDF,
} from "@/features/id-cards/id-card-print";
import { uploadImageFile } from "@/features/uploads/upload-client";
import {
  useCollection,
  useHydrated,
  useProfile,
  setProfile,
  updateItem,
  DEFAULT_ID_CARD_DESIGN,
  type Student,
  type IdCardDesign,
} from "@/lib/store/local-db";

/** Placeholder student so the live preview always has something to show. */
const SAMPLE: Student = {
  id: "sample",
  code: "MMA-0001",
  billingStartMonth: "",
  firstName: "Aarav",
  lastName: "Sharma",
  gender: "male",
  dob: "2016-04-12",
  admissionDate: "",
  courseId: "",
  batchId: "",
  monthlyFee: 0,
  centreName: "",
  hobbies: "",
  siblingAge: "",
  schoolName: "",
  schoolClass: "",
  address: "Barasat, Kolkata",
  city: "",
  pincode: "",
  fatherName: "Rohit Sharma",
  fatherContact: "9804243159",
  motherName: "",
  motherContact: "",
  parentName: "Rohit Sharma",
  parentMobile: "9804243159",
  parentEmail: "",
  photo: "",
  status: "active",
};

export function IdCardsView() {
  const hydrated = useHydrated();
  const students = useCollection("students");
  const courses = useCollection("courses");
  const batches = useCollection("batches");
  const profile = useProfile();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDesigner, setShowDesigner] = useState(false);

  // The design lives on the institute profile (one design for the whole
  // center, on every device) — same pattern as the certificate template.
  // Edits go into a local draft first; "Save design" writes it to the profile.
  const savedDesign = JSON.stringify(
    profile.idCardDesign ?? DEFAULT_ID_CARD_DESIGN,
  );
  const [design, setDesign] = useState<IdCardDesign>(() =>
    JSON.parse(savedDesign),
  );
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    // Adopt the server value when it (re)loads, unless the owner is mid-edit.
    if (!dirty) setDesign(JSON.parse(savedDesign));
  }, [savedDesign, dirty]);

  function set<K extends keyof IdCardDesign>(key: K, value: IdCardDesign[K]) {
    setDesign((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function saveDesign() {
    setProfile({ idCardDesign: design });
    setDirty(false);
    toast.success("Design saved", {
      description:
        "Applies to your whole center — every device downloads the same card.",
    });
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const tId = toast.loading("Uploading logo…");
    try {
      const url = await uploadImageFile(file);
      set("logo", url);
      toast.success("Logo uploaded", { id: tId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: tId,
      });
    }
  }

  const ctx = {
    courseName: (id: string) => courses.find((c) => c.id === id)?.name ?? "",
    batchName: (id: string) => batches.find((b) => b.id === id)?.name ?? "",
  };

  const active = useMemo(
    () => students.filter((s) => s.status === "active"),
    [students],
  );
  const pending = useMemo(
    () => active.filter((s) => !s.welcomeKit?.idCard),
    [active],
  );
  const list = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return active;
    return active.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
          .includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [active, search]);

  // Live preview uses the first selected (or first) real student, else a sample.
  const previewStudent =
    active.find((s) => selected.has(s.id)) ?? active[0] ?? SAMPLE;
  const previewHtml = previewIdCardHtml(previewStudent, profile, ctx, design);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === list.length ? new Set() : new Set(list.map((s) => s.id)),
    );
  }

  // Generate = build and download the PDF(s), then mark each card as generated
  // so the "not generated yet" reminder stays honest. Students without a photo
  // are skipped — a photo-less ID card comes straight back as a support complaint.
  async function generate(batch: Student[]) {
    const withPhoto = batch.filter((s) => s.photo);
    const skipped = batch.length - withPhoto.length;
    if (withPhoto.length === 0) {
      toast.error("No printable cards", {
        description:
          "The selected students have no photo. Add photos on the student's edit page first.",
      });
      return;
    }
    const tId = toast.loading("Preparing PDF…");
    try {
      await downloadIdCardsPdf(withPhoto, profile, ctx, design);
    } catch {
      toast.error("Could not build the PDF — please try again.", { id: tId });
      return;
    }
    withPhoto.forEach((s) =>
      updateItem<Student>("students", s.id, {
        welcomeKit: { ...s.welcomeKit, idCard: true },
      }),
    );
    const files = Math.ceil(withPhoto.length / MAX_CARDS_PER_PDF);
    toast.success(
      `${withPhoto.length} ID card${withPhoto.length > 1 ? "s" : ""} downloaded${files > 1 ? ` in ${files} PDFs` : " as PDF"}`,
      {
        id: tId,
        description:
          skipped > 0
            ? `${skipped} student${skipped > 1 ? "s were" : " was"} skipped — no photo uploaded yet.`
            : undefined,
      },
    );
    setSelected(new Set());
  }

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setShowDesigner((v) => !v)}>
        <Settings2 /> {showDesigner ? "Hide design" : "Customise design"}
      </Button>
      {selected.size > 0 && (
        <Button
          variant="outline"
          onClick={() => generate(active.filter((s) => selected.has(s.id)))}
        >
          <Download /> Download selected ({selected.size})
        </Button>
      )}
      {pending.length > 0 && (
        <Button onClick={() => generate(pending)}>
          <IdCard /> Generate all pending ({pending.length})
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="ID Cards"
        description="Student ID cards (88 × 56 mm) download as print-ready A4 PDFs — 10 cards per page with cutting marks. Print, cut and laminate."
        actions={headerActions}
      />

      {/* Customise: header branding + colours, with a live preview */}
      {showDesigner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Header branding</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Card size (88 × 56 mm), photo size and typography are fixed so
                10 cards fill an A4 sheet. Saved for your whole center — every
                device prints the same design.
              </p>
              <div className="flex items-center gap-3">
                <span className="flex size-14 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {design.logo || profile.avatar ? (
                    <img
                      src={design.logo || profile.avatar}
                      alt=""
                      className="size-14 object-contain"
                    />
                  ) : (
                    <Camera className="size-5 text-muted-foreground" />
                  )}
                </span>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onLogo}
                  />
                  <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm hover:bg-accent">
                    <Upload className="size-4" /> Upload logo
                  </span>
                </label>
                {design.logo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => set("logo", "")}
                  >
                    <X /> Remove
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Company name</Label>
                <Input
                  value={design.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder={profile.businessName || "Your institute name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tagline</Label>
                <Input
                  value={design.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder="An ISO 9001:2015 Certified Company"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input
                  value={design.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder={profile.website || "www.yourinstitute.com"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Header background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="size-10 cursor-pointer rounded-lg border"
                      value={design.headerBg}
                      onChange={(e) => set("headerBg", e.target.value)}
                    />
                    <Input
                      value={design.headerBg}
                      onChange={(e) => set("headerBg", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Header text</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="size-10 cursor-pointer rounded-lg border"
                      value={design.headerText}
                      onChange={(e) => set("headerText", e.target.value)}
                    />
                    <Input
                      value={design.headerText}
                      onChange={(e) => set("headerText", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Card background</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {CARD_BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Card colour ${c}`}
                      className={`size-8 rounded-full border-2 ${design.cardBg.toUpperCase() === c ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => set("cardBg", c)}
                    />
                  ))}
                  <input
                    type="color"
                    className="size-8 cursor-pointer rounded-full border"
                    title="Custom colour"
                    value={design.cardBg}
                    onChange={(e) => set("cardBg", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={saveDesign} disabled={!dirty}>
                  <Save /> Save design
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDesign(DEFAULT_ID_CARD_DESIGN);
                    setDirty(true);
                  }}
                >
                  Reset to default
                </Button>
                {dirty && (
                  <span className="text-xs font-medium text-amber-600">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Live preview</Label>
              <iframe
                title="ID card preview"
                srcDoc={previewHtml}
                className="h-64 w-full rounded-xl border bg-muted/30"
              />
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {previewStudent.id === "sample"
                  ? "a sample student"
                  : `${previewStudent.firstName} ${previewStudent.lastName}`.trim()}{" "}
                — all cards use the same layout.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminder: cards still to hand out */}
      {hydrated && pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <span>
            <strong>
              {pending.length} active student
              {pending.length > 1 ? "s don't" : " doesn't"} have an ID card yet.
            </strong>{" "}
            Generate them in one click — cards download as print-ready A4 PDFs
            with cutting marks.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set(pending.map((s) => s.id)))}
          >
            Select pending
          </Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!hydrated ? null : active.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title="No active students yet"
          description="Add students first — each active student gets a print-ready ID card here."
        />
      ) : (
        <Card>
          <CardContent className="space-y-2 p-4">
            <label className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4"
                checked={list.length > 0 && selected.size === list.length}
                onChange={toggleAll}
              />
              Select all ({list.length})
            </label>
            {list.map((s) => {
              const name = `${s.firstName} ${s.lastName}`.trim();
              const generated = !!s.welcomeKit?.idCard;
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2.5"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                    />
                    <span className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                      {s.photo ? (
                        <img
                          src={s.photo}
                          alt=""
                          className="size-10 object-cover"
                        />
                      ) : (
                        <Camera className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.code}
                        {ctx.courseName(s.courseId)
                          ? ` · ${ctx.courseName(s.courseId)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!s.photo ? (
                      <Badge
                        variant="outline"
                        className="border-red-300 text-red-600"
                        title="Upload a photo on the student's edit page"
                      >
                        <Link href={`/students/${s.id}/edit`}>
                          No photo — add
                        </Link>
                      </Badge>
                    ) : generated ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 text-emerald-600"
                      >
                        Generated
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-600"
                      >
                        Not generated
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!s.photo}
                      onClick={() => generate([s])}
                    >
                      <Download />{" "}
                      {generated ? "Download again" : "Download PDF"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
