"use client";

/* eslint-disable @next/next/no-img-element */
import { forwardRef } from "react";
import { Poppins, Pacifico } from "next/font/google";
import type { Student, Profile } from "@/lib/store/local-db";

export type Occasion = "welcome" | "birthday";

// Real web fonts (self-hosted by next/font, so html-to-image can embed them).
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", display: "swap" });

const fullName = (s: Student) => `${s.firstName} ${s.lastName}`.trim();
const parentName = (s: Student) => s.parentName || s.fatherName || s.motherName || "Parent";
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "🙂";

function Photo({ student, size, ring }: { student: Student; size: number; ring: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", padding: 12, background: ring, boxShadow: "0 22px 50px rgba(0,0,0,0.22)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#eef2f7", display: "flex", alignItems: "center", justifyContent: "center", border: "6px solid #fff" }}>
        {student.photo
          ? <img src={student.photo} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: size * 0.36, fontWeight: 800, color: "#94a3b8" }}>{initials(fullName(student))}</span>}
      </div>
    </div>
  );
}

function Confetti({ colors }: { colors: string[] }) {
  const dots = [
    { x: 60, y: 210, s: 26, r: 20 }, { x: 980, y: 250, s: 20, r: -15 }, { x: 120, y: 560, s: 16, r: 40 },
    { x: 940, y: 620, s: 28, r: 10 }, { x: 80, y: 980, s: 22, r: -25 }, { x: 1000, y: 1040, s: 18, r: 30 },
    { x: 500, y: 180, s: 14, r: 0 }, { x: 300, y: 250, s: 12, r: 45 }, { x: 760, y: 210, s: 16, r: -30 },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <div key={i} style={{ position: "absolute", left: d.x, top: d.y, width: d.s, height: d.s, borderRadius: i % 2 ? "50%" : 4, background: colors[i % colors.length], transform: `rotate(${d.r}deg)`, opacity: 0.9 }} />
      ))}
    </>
  );
}

function Logo({ profile }: { profile: Profile }) {
  return profile.avatar ? <img src={profile.avatar} alt="" crossOrigin="anonymous" style={{ height: 76, width: "auto", objectFit: "contain" }} /> : null;
}

function Footer({ profile, bg }: { profile: Profile; bg: string }) {
  const bits = [profile.phone && `📞 ${profile.phone}`, (profile.address || profile.city) && `📍 ${profile.address || profile.city}`].filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: bg, color: "#fff", padding: "28px 0", display: "flex", justifyContent: "center", gap: 56, fontSize: 30, fontWeight: 600 }}>
      {bits.map((b, i) => <span key={i}>{b}</span>)}
    </div>
  );
}

export const PosterCard = forwardRef<HTMLDivElement, { occasion: Occasion; student: Student; profile: Profile }>(
  function PosterCard({ occasion, student, profile }, ref) {
    const name = fullName(student);
    const biz = profile.businessName || "our centre";
    const base: React.CSSProperties = { width: 1080, height: 1350, position: "relative", overflow: "hidden", fontFamily: poppins.style.fontFamily, color: "#1f2937" };

    if (occasion === "birthday") {
      const PINK = "#e11d80", PURPLE = "#7c3aed";
      return (
        <div ref={ref} style={{ ...base, background: "linear-gradient(165deg,#fff7f0 0%,#fdeaf4 45%,#efe9fe 100%)" }}>
          <Confetti colors={["#f59e0b", PINK, PURPLE, "#22c55e", "#3b82f6"]} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "48px 60px 0" }}>
            <Logo profile={profile} />
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, color: PURPLE, textTransform: "uppercase" }}>{biz}</div>
          </div>
          <div style={{ position: "relative", textAlign: "center", marginTop: 8 }}>
            <div style={{ fontFamily: pacifico.style.fontFamily, fontSize: 128, color: PINK, lineHeight: 1.1 }}>Happy Birthday</div>
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 24 }}>
            <Photo student={student} size={420} ring={`linear-gradient(135deg,${PINK},${PURPLE})`} />
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 30 }}>
            <div style={{ background: PURPLE, color: "#fff", fontWeight: 700, fontSize: 46, padding: "16px 54px", borderRadius: 999, boxShadow: "0 12px 26px rgba(124,58,237,0.35)" }}>{name}</div>
          </div>
          <div style={{ position: "relative", textAlign: "center", color: "#475569", fontSize: 34, lineHeight: 1.55, padding: "30px 130px 0", fontWeight: 500 }}>
            Wishing you a day full of joy, laughter and wonderful memories. May this year bring happiness, success and bright achievements! 🌟
          </div>
          <div style={{ position: "relative", textAlign: "center", color: PINK, fontWeight: 700, fontSize: 34, marginTop: 22 }}>— With love, {biz}</div>
          <Footer profile={profile} bg={`linear-gradient(90deg,${PURPLE},${PINK})`} />
        </div>
      );
    }

    // welcome / new admission
    const BLUE = "#1e3a8a", INDIGO = "#4f46e5", SKY = "#3b82f6", AMBER = "#f59e0b";
    const feats = ["Abacus-Based Learning", "Better Focus & Confidence", "Bright, Confident Future"];
    return (
      <div ref={ref} style={{ ...base, background: "#eef2fb" }}>
        {/* top brand block with rounded bottom */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 470, background: `linear-gradient(135deg,${INDIGO},${SKY})`, borderBottomLeftRadius: 80, borderBottomRightRadius: 80 }} />
        <Confetti colors={["#fbbf24", "#fff", "#a5b4fc", "#f472b6"]} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "46px 60px 0" }}>
          <Logo profile={profile} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{biz}</div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 18 }}>
          <div style={{ background: AMBER, color: "#1f2937", fontWeight: 800, fontSize: 40, letterSpacing: 2, padding: "14px 46px", borderRadius: 999, boxShadow: "0 10px 24px rgba(0,0,0,0.18)" }}>NEW ADMISSION 🎉</div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 40 }}>
          <Photo student={student} size={380} ring="#ffffff" />
        </div>
        <div style={{ position: "relative", textAlign: "center", marginTop: 26 }}>
          <div style={{ color: "#64748b", fontSize: 30, fontWeight: 600 }}>A warm welcome to</div>
          <div style={{ color: INDIGO, fontWeight: 800, fontSize: 66, lineHeight: 1.1, marginTop: 4 }}>{name}</div>
        </div>
        <div style={{ position: "relative", margin: "26px 80px 0", background: "#fff", borderRadius: 28, padding: "34px 46px", boxShadow: "0 18px 44px rgba(30,58,138,0.12)", textAlign: "center", color: "#475569", fontSize: 31, lineHeight: 1.5, fontWeight: 500 }}>
          Dear {parentName(student)}, we&apos;re delighted to welcome {name} to the {biz} family. Your welcome kit is ready at the centre — here&apos;s to a bright learning journey ahead!
        </div>
        <div style={{ position: "absolute", left: 60, right: 60, bottom: 150, display: "flex", gap: 16, justifyContent: "center" }}>
          {feats.map((f, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", background: "#fff", color: BLUE, fontWeight: 700, fontSize: 23, padding: "18px 10px", borderRadius: 18, boxShadow: "0 8px 20px rgba(0,0,0,0.06)" }}>{f}</div>
          ))}
        </div>
        <Footer profile={profile} bg={`linear-gradient(90deg,${BLUE},${INDIGO})`} />
      </div>
    );
  },
);
