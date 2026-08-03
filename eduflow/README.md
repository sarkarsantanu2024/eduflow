# EduFlow marketing site

Three pages — `index.html`, `privacy.html`, `terms.html`. No build step, no bundler, no framework.
All the logic (comparison table, ROI calculator, lead form) is inline JavaScript.

**Built with:** Tailwind CSS (CDN), Google Fonts — Plus Jakarta Sans for headings, Inter for body —
and Material Symbols Rounded for icons. The EduFlow logo is inline SVG (the same orange rounded square
and graduation cap the app uses), so there is no image file to manage and it stays sharp at any size.

---

## What is my website link?

This is the address people type or click to reach your site. You have two options.

### Option A — free, ready in 10 minutes

Deploy the folder and use the address the host gives you:

- **Vercel** → `eduflow.vercel.app` (or `eduflow-abc123.vercel.app` if the name is taken)
- **Netlify** → `eduflow.netlify.app`

This is a real, working, HTTPS website. It costs nothing and you can start putting it on Facebook and
LinkedIn the same day. You can add your own domain later without losing anything.

### Option B — your own domain, ~₹800–1,200 a year

Buy `eduflow.in` (or `eduflowindia.com`, `myeduflow.in` …) from GoDaddy, Hostinger, BigRock or
Namecheap, then point it at Vercel/Netlify in their dashboard. It looks more serious on a visiting
card and in a Facebook ad, and it is worth the money once you have a few customers.

**Recommendation:** launch on the free `.vercel.app` address today, buy the `.in` domain this month.

### If you buy a domain, update these lines

Search `index.html`, `privacy.html` and `terms.html` for `eduflow.in` and replace it in:

- `<link rel="canonical" href="https://www.eduflow.in/" />`
- `<meta property="og:url" content="https://www.eduflow.in/" />`
- `<meta property="og:image" content="https://www.eduflow.in/og-cover.png" />`
- the email addresses `privacy@eduflow.in` and `support@eduflow.in`

Until then, those tags are harmless — they only affect Google and link previews, not whether the site
works.

---

## Before you publish — the edits you must make

1. **Your WhatsApp number.** In `index.html`:
   ```js
   var WHATSAPP_NUMBER = "919804243159";
   ```
   Country code + number, digits only, no `+` and no spaces. This powers the floating chat button,
   the "WhatsApp us now" button, the sticky mobile bar and the demo form.

2. **Your app's address.** Also in `index.html`:

   ```js
   var APP_URL = "";
   ```

   Set this to where the EduFlow application itself is hosted — e.g. `"https://app.eduflow.in"` or
   `"https://eduflow-saas.vercel.app"`. One setting, two jobs:

   - the **Login** button in the header points at `<APP_URL>/login`
   - the demo form saves each enquiry to `<APP_URL>/api/leads`, which appears under
     **Admin → Leads** inside the app

   Leave it `""` and the Login button simply stays hidden (so it can never 404) while the form still
   works — it just opens WhatsApp without saving anything.

3. **Your phone number** — search for `tel:+919804243159` and replace it (it appears on the contact
   section and in both legal pages).

4. **Your social links** — in the footer, replace the Facebook and LinkedIn URLs.

5. **Read the two legal pages.** `privacy.html` and `terms.html` are complete, written to match how
   EduFlow actually works, and ready to publish — but they are drafts written by a developer, not a
   lawyer. Check the company name, the jurisdiction (currently Kolkata, West Bengal) and the email
   addresses. Have a CA or lawyer review them before you take money at scale. **Facebook will not
   approve a lead-generation ad without a reachable privacy policy**, which is why they exist.

Optional: add an `og-cover.png` (1200×630) to this folder — a screenshot of the dashboard with the
headline across it. It becomes the preview image when the link is shared on Facebook, LinkedIn or
WhatsApp, and a good one materially increases clicks.

---

## Collecting leads (how it fits together)

```
Website form  →  POST <APP_URL>/api/leads  →  leads table  →  Admin → Leads
     │                                                              │
     └── also opens WhatsApp with the details pre-filled            └── call / WhatsApp / notes / status / export
```

**Set-up, once:**

1. Apply the migration in the app: `psql "$DATABASE_URL" -f drizzle/0004_leads.sql`
   (or `npm run db:push`).
2. Deploy the app, then set `APP_URL` in `index.html` to the app's address.
3. Sign in as super-admin → the **Leads** card on the admin home → **Open leads**.

Every enquiry shows name, center, type, student count and phone, with one-tap **Call** and
**WhatsApp** buttons, a status you can move through *New → Contacted → Demo booked → Won / Lost*,
private notes, and a **Download** button for CSV/Excel.

The form has a hidden honeypot field that silently absorbs bot submissions, and it never blocks the
lead: if the API is unreachable, WhatsApp still opens so you don't lose the person.

---

## Publish it free

**Vercel (easiest)**

1. vercel.com → *Add New → Project → Deploy without Git*, drag this `marketing-site` folder in.
2. Add your domain under *Settings → Domains*.

**Netlify**

1. netlify.com → *Sites → Add new site → Deploy manually*, drag the folder in.
2. *Domain settings → Add custom domain*.

**GitHub Pages** — push this folder to a repo and enable Pages on it.

All three are free for a static site and give you HTTPS automatically.

---

## Demo logins

Credentials for every demo login — super-admin, the head-office console and one owner login per
business type — are in **`deliverables/EduFlow-Demo-Credentials.txt`**. Keep that file private and
off any public repository.

---

## After launch

- Add the **Facebook Pixel** snippet (Events Manager → copy the base code) just before `</head>` on
  `index.html` — do it on day one so your retargeting audience builds while you're still posting
  organically.
- Add **Vercel Analytics** or Google Analytics to see which posts actually send traffic.
- **Before heavy traffic or ads:** the Tailwind CDN compiles styles in the browser, which is fine for
  launch but adds ~100 ms and prints a console warning. When you're ready, run
  `npx tailwindcss -i input.css -o style.css --minify` once and swap the `<script src="…tailwindcss">`
  tag for `<link rel="stylesheet" href="style.css">`. Nothing else changes.
