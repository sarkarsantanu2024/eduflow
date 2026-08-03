# EduFlow marketing site

Three pages, now living in **`public/`** at the repo root and served by the app itself:

| File | Public URL |
| --- | --- |
| `public/site.html` | `/` (via the `beforeFiles` rewrite in `next.config.ts`) |
| `public/privacy.html` | `/privacy.html` |
| `public/terms.html` | `/terms.html` |

No build step, no bundler, no framework — all the logic (comparison table, ROI calculator, lead form)
is inline JavaScript. They deploy with the app, so there is nothing separate to publish.

**Built with:** Tailwind CSS (CDN), Google Fonts — Plus Jakarta Sans for headings, Inter for body —
and Material Symbols Rounded for icons. The EduFlow logo is inline SVG (the same orange rounded square
and graduation cap the app uses), so there is no image file to manage and it stays sharp at any size.

---

## What is my website link?

**`https://eduflow.nexvoratechnologies.co.in`** — one hostname for both the website and the product:

```text
/                 marketing site   (public/site.html)
/login            sign in
/dashboard        the product, after login
/privacy.html     privacy policy
/terms.html       terms of service
```

The old `eduflow-topaz-six.vercel.app` address keeps working as well — Vercel serves every hostname
attached to the project — so it stays available as a rollback.

### If you ever change the domain again

Search `public/*.html` for `nexvoratechnologies` and update:

- `<link rel="canonical" … />` on all three pages
- `<meta property="og:url" … />` and `<meta property="og:image" … />` in `site.html`

Then set `NEXT_PUBLIC_APP_URL` in Vercel to the new address and **redeploy** (it builds the
password-reset links). Nothing else is hard-coded: every in-page link is relative.

The email addresses `privacy@eduflow.in` / `support@eduflow.in` in the legal pages are separate —
change them only when you have real mailboxes.

---

## Before you publish — the edits you must make

1. **Your WhatsApp number.** In `public/site.html`:

   ```js
   var WHATSAPP_NUMBER = "919804243159";
   ```

   Country code + number, digits only, no `+` and no spaces. This powers the floating chat button,
   the "WhatsApp us now" button, the sticky mobile bar and the demo form.

2. **Your app's address.** Also in `public/site.html`:

   ```js
   var APP_URL = "";
   ```

   **Leave this empty.** The page is now served by the app itself, so `/login` and `/api/leads` are
   already on the same origin. Empty means:

   - the **Login** button in the header points at `/login`
   - the demo form saves each enquiry to `/api/leads`, which appears under **Admin → Leads**

   Only set an absolute URL (e.g. `"https://eduflow.nexvoratechnologies.co.in"`) if you ever host
   this page somewhere else — a separate Vercel project, S3, a WordPress site. Cross-origin lead
   posts then need `/api/leads` to allow that origin.

3. **Your phone number** — search for `tel:+919804243159` and replace it (it appears on the contact
   section and in both legal pages).

4. **Your social links** — in the footer, replace the Facebook and LinkedIn URLs.

5. **Read the two legal pages.** `privacy.html` and `terms.html` are complete, written to match how
   EduFlow actually works, and ready to publish — but they are drafts written by a developer, not a
   lawyer. Check the company name, the jurisdiction (currently Kolkata, West Bengal) and the email
   addresses. Have a CA or lawyer review them before you take money at scale. **Facebook will not
   approve a lead-generation ad without a reachable privacy policy**, which is why they exist.

Optional: add an `og-cover.png` (1200×630) to `public/` (the `og:image` tag already points at `/og-cover.png`) — a screenshot of the dashboard with the
headline across it. It becomes the preview image when the link is shared on Facebook, LinkedIn or
WhatsApp, and a good one materially increases clicks.

---

## Collecting leads (how it fits together)

```
Website form  →  POST /api/leads            →  leads table  →  Admin → Leads
     │                                                              │
     └── also opens WhatsApp with the details pre-filled            └── call / WhatsApp / notes / status / export
```

**Set-up, once:**

1. Apply the migration in the app: `psql "$DATABASE_URL" -f drizzle/0004_leads.sql`
   (or `npm run db:push`).
2. Deploy the app — the form posts to `/api/leads` on the same origin, nothing to configure.
3. Sign in as super-admin → the **Leads** card on the admin home → **Open leads**.

Every enquiry shows name, center, type, student count and phone, with one-tap **Call** and
**WhatsApp** buttons, a status you can move through *New → Contacted → Demo booked → Won / Lost*,
private notes, and a **Download** button for CSV/Excel.

The form has a hidden honeypot field that silently absorbs bot submissions, and it never blocks the
lead: if the API is unreachable, WhatsApp still opens so you don't lose the person.

---

## Publishing

Nothing to do — the pages live in `public/`, so they ship with every deploy of the app. Push to
`main`, Vercel builds, and `https://eduflow.nexvoratechnologies.co.in/` serves the new copy.

To preview locally: `npm run dev`, then open `http://localhost:3000/`.

---

## Demo logins

Credentials for every demo login — super-admin, the head-office console and one owner login per
business type — are in **`deliverables/EduFlow-Demo-Credentials.txt`**. Keep that file private and
off any public repository.

---

## After launch

- Add the **Facebook Pixel** snippet (Events Manager → copy the base code) just before `</head>` on
  `public/site.html` — do it on day one so your retargeting audience builds while you're still posting
  organically.
- Add **Vercel Analytics** or Google Analytics to see which posts actually send traffic.
- **Before heavy traffic or ads:** the Tailwind CDN compiles styles in the browser, which is fine for
  launch but adds ~100 ms and prints a console warning. When you're ready, run
  `npx tailwindcss -i input.css -o style.css --minify` once and swap the `<script src="…tailwindcss">`
  tag for `<link rel="stylesheet" href="style.css">`. Nothing else changes.
