# Vikram Engineering Co. — website

Public marketing site. Next.js 15 + Tailwind 4, deployed static, with Supabase
handling only the two public forms. The payroll portal is phase 2.

---

## Run it locally

```bash
npm install
npm run fetch-images   # downloads the 23 stock photos into public/images
npm run dev            # http://localhost:3000
```

`npm run fetch-images` only needs to run once. The images are not committed to
git and are not stored in Supabase — they are served statically from
`public/images`.

### If the page feels slow to load, you are looking at `npm run dev`

`next dev` compiles on demand, so the first load can take a few seconds.
**This is the dev server, not the site.** Navigation between sections is now
pure scrolling and is instant either way.

To see the real speed, build once and serve the built output:

```bash
npm run build && npm start
```

Measured on this machine, production serves every page in **5–10 ms**, and
in-app navigation is instant because all seven pages are pre-rendered static
HTML. That is also what Vercel will serve.

**Important:** never run `npm run build` while `npm run dev` is running. The
dev server writes into the same `.next` directory and will corrupt the
production build — you get `Cannot find module './124.js'` and a 500 page.
Stop the dev server first, or `rm -rf .next` and rebuild.

---

## Connect Supabase

1. Open the SQL Editor in project `swpkutpeimuoomculpbz` and run
   [`docs/sql/01-website.sql`](docs/sql/01-website.sql) once. It is idempotent,
   so re-running it is safe.
2. Copy `.env.example` to `.env.local` and fill in the anon key from
   **Project Settings → API**:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://swpkutpeimuoomculpbz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

3. Restart `npm run dev` and submit the contact form. The row should appear in
   **Table Editor → enquiries**.

Until the anon key is set, both forms stay up but tell the visitor to email or
call instead, rather than silently failing.

**Do not put `SUPABASE_SERVICE_ROLE_KEY` in this project yet.** Nothing on the
public site needs it, and leaving it out means a mistake here cannot expose
payroll data later.

---

## Storage buckets

**None are needed right now.** Deliberately:

| Asset | Where it lives | Why |
|---|---|---|
| Stock photographs | `public/images` | Static files on the CDN cost nothing and load faster than a signed Supabase URL. |
| Logo, favicon | `public/*.svg` | Same. |
| Job applications | `job_applications` table, no file | The Careers form takes no resume upload. Most of our applicants are helpers and fitters applying from a phone — asking for a PDF loses them. We capture name, phone, trade and experience, and call them. |

Create buckets in phase 2, when the portal exists:

| Bucket | Public? | Holds | Approx size |
|---|---|---|---|
| `employee-docs` | **Private** | Aadhaar, bank proof, gate pass, medical, safety training | Compress images to ≤ 200 KB before upload |
| `work-orders` | **Private** | Scanned client work orders and rate contracts | Optional, PDFs ≤ 1 MB |
| `site-photos` | Public | Real photographs of our sites, replacing the stock images | ≤ 300 KB WebP |
| `resumes` | **Private** | Only if a resume upload is added to Careers | ≤ 2 MB PDF |

Every one of those except `site-photos` must be private, with signed URLs — they
hold workers' identity documents.

---

## About the photographs

All 23 images are generic industry stock from Pexels (free commercial use, no
attribution required). **They are not photographs of our sites**, and the code
enforces that honesty: every one renders with a "Representative image" marker,
and `lib/images.ts` carries an `isStock` flag.

To replace one with a real photograph:

1. Drop the file in `public/images/` under the same slug name.
2. Set `isStock: false` for that slug in `lib/images.ts`.

The marker disappears. Nothing else changes.

Ten real photos from Bathinda and Debari would be worth more than all 23 of
these — worth asking for.

---

## Structure

```
app/page.tsx    the whole site — one page, six anchored sections
app/actions.ts  server actions for the two public forms — validation + insert
components/     Header (anchor nav + scroll-spy), Splash, Footer,
                ProjectGrid (clickable cards + detail panel), Plate,
                Counter, Forms, Reveal, ui primitives
lib/content.ts  all copy, projects, services, trades, registrations
lib/images.ts   the image manifest
scripts/        fetch-images.mjs
docs/sql/       Supabase SQL, run in order
```

**Single page, six sections.** `#top` `#services` `#projects` `#about`
`#careers` `#contact`. Nav items are in-page anchors, so a click is a scroll —
there is no route to fetch or compile, which is what made the old tabs feel
slow. Compliance is folded into the About section.

**Project detail** is a panel, not a page: each card's photograph is a button
that opens the full scope, client, location and period. Escape or a click
outside closes it.

**All site copy lives in `lib/content.ts`.** To change a project description or
add a client, edit that file — no component needs touching.

---

## Deploy

Push to GitHub, import into Vercel, and set the two `NEXT_PUBLIC_*` environment
variables. Build command and output directory are detected automatically.

Before going live, set the real domain in `app/layout.tsx` (`siteUrl`),
`app/sitemap.ts` and `app/robots.ts` — all three currently point at
`vikramengineering.co.in`.

---

## Still to confirm

- **Year of establishment.** The oldest work order on file is 2015; the firm may
  be older. The site says "since 2015" throughout.
- **Two different LINs.** The EPFO employer profile shows `1966443026`; the ESIC
  employer login shows `1383891279`. A Labour Identification Number should be
  unique to an establishment. The Compliance page currently shows the EPFO one.
- **Labour Licence number** for a current site, if it should be listed.
- **Domain name** — nothing is registered yet.
