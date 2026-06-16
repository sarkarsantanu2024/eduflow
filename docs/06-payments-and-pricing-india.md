# EduFlow — Payments & Pricing Strategy (India: Kolkata → Tier-2/3 → Rural)

> Written as a market-research brief. Target buyers = small local service
> businesses: abacus/tuition/coaching, dance/drawing/music academies, activity
> centers, gyms, salons, playschools. Low ARPU, extreme price sensitivity,
> UPI-first, cash-still-common, low tolerance for KYC paperwork.

---

## 0. The single most important insight

There are **two different payment flows** and people confuse them. Design both:

| | Flow A — **Fee Collection** | Flow B — **SaaS Subscription** |
|---|---|---|
| Who pays | The end customer (parent / member / client) | The business owner |
| Pays whom | The business (your customer) | EduFlow (you) |
| Money touches you? | **No** (recommended) — goes straight to the business | Yes |
| Typical size | ₹300 – ₹5,000 / month | ₹0 – ₹1,500 / month |
| Must support | UPI, **manual UPI/QR**, **cash record** | UPI, cards, annual UPI AutoPay |

If you only build Razorpay auto-collection you will **lose the rural + small
end of the market**, because most of them won't complete gateway KYC. The
rural-winning feature is **"record a cash/UPI payment + auto-generate receipt +
auto WhatsApp confirmation"** with *zero* gateway onboarding.

---

## 1. Market reality you are pricing against

- **UPI is ~the default.** PhonePe + Google Pay + Paytm dominate. Any flow that
  isn't "scan QR / tap UPI" adds friction. Cards/netbanking are secondary.
- **Cash hasn't died**, especially villages and very small centers. The app must
  let owners *record* cash and still print a receipt + send WhatsApp.
- **MDR (transaction fee) on UPI P2M is zero by RBI mandate.** Collecting fees by
  UPI is effectively free — lean into UPI hard.
- **WhatsApp is the communication channel**, not email. Email open rates are near
  zero here. Reminders/receipts must go on WhatsApp.
- **Annual > monthly.** Small owners dislike monthly auto-debits they have to
  watch. An annual plan paid once by UPI converts better and cuts churn.
- **Trust gap.** They worry "will my money get stuck?" Keep money out of your
  hands (direct settlement to the business) → easier sell, lighter compliance.

---

## 2. Flow A — Fee Collection (your customer collects from THEIR customers)

Offer **three tiers of capability**, so every business from a village tutor to a
city gym can start same-day:

### Tier 1 — Manual record (zero onboarding) — *rural unlock*
- Owner collects **cash** or **own personal UPI QR**, then taps "Mark Paid".
- App generates a **PDF receipt** + sends a **WhatsApp confirmation**.
- No gateway, no KYC, works for everyone on day one. Already modeled in DB
  (`payments.method = 'cash' | 'upi'`).

### Tier 2 — UPI / Razorpay Payment Link (semi-automated)
- App creates a **Razorpay Payment Link**, sends it on WhatsApp; customer pays
  by UPI/card; webhook marks it paid and issues the receipt automatically.
- Already implemented: `src/services/razorpay.ts` + `/api/webhooks/razorpay`.

### Tier 3 — UPI AutoPay e-mandate (recurring) — *city / organized centers*
- Monthly tuition/gym fees auto-debit via **UPI AutoPay** (Razorpay
  Subscriptions). Best for centers with steady monthly billing.

### Who holds the money? → **Direct settlement (recommended for v1)**
Each business connects **their own Razorpay account**; money settles to *them*
(T+2), not to you. You never become a payment intermediary → no PA/PG licence
burden, no float liability, much easier trust pitch.

> Later, if you want to take a per-transaction cut, use **Razorpay Route**
> (marketplace split). That adds compliance + reconciliation work — defer it.

### Gateway fees the business will pay (verify current Razorpay rates)
- **UPI:** typically **0% / near-zero** (zero-MDR mandate). Headline benefit.
- **Cards / netbanking / wallets:** ~**2%** + **18% GST on the fee**.
- Settlement usually **T+2**. Razorpay Payment Links & UPI QR are standard.
- Alternatives to keep as backups: **Cashfree, PhonePe PG, Paytm PG**.

---

## 3. Flow B — Your SaaS subscription pricing (what they pay YOU)

### Strategy
1. **Freemium to drive bottom-of-market + rural adoption.** Land free, upsell on
   WhatsApp volume + online collection + reports.
2. **Lead with the ANNUAL price** (show "₹X/month, billed yearly"). Give ~2
   months free on annual.
3. **Bundle a WhatsApp quota** (it's your main variable cost — see §4) and sell
   **top-ups**.
4. Accept your own subscription payments via **UPI + UPI AutoPay + cards**
   (Razorpay Subscriptions).

### Recommended price ladder (INR) — tuned for tier-2/3/rural

| Plan | Monthly | **Annual (recommended)** | Members | WhatsApp/mo | Online collection | Locations |
|------|--------:|-------------------------:|--------:|------------:|-------------------|----------:|
| **Free** | ₹0 | ₹0 | up to 30 | 0 (manual only) | manual cash/UPI record | 1 |
| **Starter** | ₹399 | **₹3,999** (~₹333/mo) | up to 150 | 500 | Payment Links | 1 |
| **Growth** | ₹799 | **₹7,999** (~₹667/mo) | up to 600 | 2,000 | Links + UPI AutoPay + reports | 2 |
| **Pro** | ₹1,499 | **₹14,999** (~₹1,250/mo) | unlimited | 5,000 | everything + multi-staff | 5 |

Add-ons: **WhatsApp top-up** (e.g. ₹199 / 1,000 utility messages), **extra
location**, **extra staff seat**. (These are levers, not core price.)

> This is slightly lower at entry than the original ₹499/₹999/₹1999 spec —
> deliberately, to win the rural + micro segment where ₹499/mo is a real
> objection. The annual plans recover ARPU and reduce churn.

### Why these numbers
- A small tutor/dance teacher anchors against "₹0, I do it on paper/WhatsApp by
  hand." You must beat *free effort*, so **Free tier** removes the entry barrier
  and **₹3,999/yr** (≈ ₹11/day) is an easy "yes" once they feel the time saved.
- City gyms/salons/playschools have higher willingness-to-pay and want AutoPay +
  reports + multi-staff → that's where Growth/Pro margin lives.

---

## 4. Costs to watch (your COGS) — this decides your margins

- **WhatsApp (Meta) per-message pricing.** Fee reminders are the **"Utility"**
  category → cheap (roughly **₹0.10–0.20 / message** in India; verify current
  Meta rates, they change). Marketing-category messages cost more (~₹0.7+).
  Keep reminders Utility-category and within the 24h service window where
  possible (often free). At ~₹0.15, 2,000 reminders ≈ ₹300 → comfortably covered
  by the Growth price. **This is your main variable cost — bundle + meter it.**
- **Payment gateway fee:** borne by the *business* in the direct-settlement
  model, so not your COGS (good). Only your *own* subscription collection incurs
  ~2% (or ~0% if they pay you by UPI).
- **Supabase + Vercel:** low fixed cost at this scale; grows with usage.

---

## 5. Compliance (India) — keep it light early

- **GST on your SaaS:** 18%. But a small service provider is **exempt below ₹20
  lakh** annual turnover (services), incl. inter-state supply (Notif. 10/2017).
  So you can start pan-India **without GST registration**; register once you
  approach ₹20 lakh. Show GST-inclusive prices later.
- **Don't hold customer money.** Direct settlement (each business's own Razorpay)
  keeps you out of **Payment Aggregator (PA) licensing** scope.
- **Each business's GSTIN** is captured per tenant (`institutes.gst_number`) so
  their fee **receipts** can show it.
- **Data:** store minimal parent/customer PII; honor deletion. (DPDP Act.)

---

## 6. What this means for the product (next build steps)

These map to your "✅" list, generalized for all the business types you named:

1. **Generalize terminology per business type** (see §7) — "Student" → Member /
   Client / Child depending on vertical.
2. **Manual payment + receipt + WhatsApp confirmation** flow (rural unlock) —
   highest-leverage feature for India reach.
3. **Razorpay Payment Link send-on-WhatsApp** (Tier 2) — already wired; add the
   "Collect fee" button + link generation in the Fees UI.
4. **UPI AutoPay / Razorpay Subscriptions** for recurring fees (Tier 3) + for
   your own SaaS billing.
5. **Plan limits + WhatsApp metering + top-ups** enforced from
   `subscription_plans` / `subscriptions`.
6. **Receipt PDF** with business logo + GSTIN.

---

## 7. One product, many verticals (terminology mapping)

EduFlow's data model is already generic (`institutes` = the business,
`students` = the people it serves). Sell it per vertical by swapping labels via a
**business-type setting** — no schema change:

| Business type | "Institute" → | "Student" → | "Batch/Course" → |
|---|---|---|---|
| Abacus / Tuition / Coaching | Center / Institute | Student | Batch / Course |
| Dance / Drawing / Music academy | Academy | Student | Class / Level |
| Activity center / Playschool | Center | Child | Group / Class |
| Gym / Fitness | Gym | Member | Plan / Membership |
| Salon | Salon | Client | Service / Package |

Implementation: add `institutes.business_type` + a label map; the UI reads labels
from the map. This lets one codebase address every local-business niche you
listed while the fee/payment/WhatsApp engine stays identical.
