# Connecting Supabase

Project: **`swpkutpeimuoomculpbz`** · Dashboard: https://supabase.com/dashboard/project/swpkutpeimuoomculpbz

Four steps, about ten minutes. Do them in order.

---

## Step 1 — Run the SQL

Open **SQL Editor → New query** in the dashboard, paste each file whole, and press Run. Both are idempotent, so re-running them is safe.

| Order | File | Creates |
|---|---|---|
| 1 | [`docs/sql/01-website.sql`](sql/01-website.sql) | `enquiries`, `job_applications`, `projects`, `site_images`, `openings`, `app_settings` + RLS + your seed data |
| 2 | [`docs/sql/02-auth.sql`](sql/02-auth.sql) | `profiles`, the `user_role` enum, the auto-profile trigger, `is_admin()` / `can_access_site()` helpers + RLS |
| 3 | [`docs/sql/03-fix-role-guard.sql`](sql/03-fix-role-guard.sql) | Fixes the guard trigger so the first admin can actually be created. **Only needed if you ran an earlier copy of `02-auth.sql`** — the current `02` already contains the fix. |

After each run you should see **Success. No rows returned.**

**Check it worked.** Run this and expect seven tables, `rls_on` true on every one:

```sql
select tablename, rowsecurity as rls_on,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
order by tablename;
```

The row that matters most is `enquiries`: it must allow **insert** for `anon` and **select** only for `authenticated`. Get that backwards and your enquiry inbox is readable by anyone with the anon key — which ships to every visitor's browser.

---

## Step 2 — Add the keys

In the dashboard: **Project Settings → API**. Copy the Project URL and the `anon` `public` key.

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://swpkutpeimuoomculpbz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart the dev server — Next.js reads env only at startup.

**Leave `SUPABASE_SERVICE_ROLE_KEY` empty.** It bypasses row-level security completely. Nothing in this project needs it, and an unset key cannot leak.

---

## Step 3 — Create the first account

There is no public sign-up, by design. Accounts are made by you.

**Authentication → Users → Add user → Create new user**

- Email: any address you control
- Password: set one
- **Tick "Auto Confirm User"** — otherwise the account cannot sign in until a confirmation email is clicked

The trigger from `02-auth.sql` creates the matching `profiles` row automatically, with role `hr`. Promote it to admin in the SQL Editor:

```sql
update profiles
set full_name = 'Harjeet Singh', role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

Verify:

```sql
select u.email, p.full_name, p.role
from profiles p join auth.users u on u.id = p.id;
```

---

## Step 4 — Test it

```bash
npm run build && npm start
```

| Test | Expected |
|---|---|
| Open `/` and submit the contact form | A row appears in **Table Editor → enquiries** |
| Open `/portal` while signed out | Redirects to `/login` |
| Sign in at `/login` | Lands on `/portal` showing your name and role |
| Click **Sign out** | Back to `/login`; `/portal` is blocked again |
| Sign in, then visit `/login` | Redirects to `/portal` |

---

## How it fits together

```
middleware.ts            Refreshes the auth token on every request and
                         blocks /portal when signed out. Uses getUser(),
                         not getSession() — getSession only reads the
                         cookie and can be forged, so it must never gate.

lib/supabase/server.ts   Client for Server Components and Server Actions.
                         Anon key + the user's cookie, so every query runs
                         as that user and RLS applies.

lib/supabase/client.ts   Client for Client Components.

lib/supabase.ts          Separate anon client for the two PUBLIC forms.
                         No session; insert-only by policy.

app/(site)/              Marketing page. Splash, anchor nav, footer.
app/(auth)/login/        Sign-in. No marketing chrome.
app/(portal)/portal/     Signed-in area. No marketing chrome.
```

Three route groups, three different chromes, one URL structure — `/`, `/login`, `/portal`.

### Two layers of protection, deliberately

The middleware blocks `/portal`, **and** the page itself re-checks `getUser()` and redirects. That looks redundant. It isn't: a page that reads user data should never assume the gate in front of it actually ran. Middleware config changes, matchers get edited, and a page that trusts its caller is one bad regex away from leaking.

Underneath both sits RLS, which is the real boundary. Even with a valid session, Postgres only returns rows the policies allow.

### One thing to know about `profiles`

A signed-in user can update their own row — that is how they would edit their own name. RLS cannot compare old values to new ones, so on its own that would let anyone set `role = 'admin'`. A `before update` trigger (`guard_profile_role`) rejects any change to `role`, `site_ids` or `is_active` unless the caller is an admin.

The trigger stands aside when `auth.uid()` is `NULL` — the SQL Editor, a migration, or a service-role task. Those already bypass RLS entirely, so gating them adds no safety, and gating them made the very first admin impossible to create: `is_admin()` cannot be true when no admin exists yet.

---

## Deploying

On Vercel: **Settings → Environment Variables**, add the same two `NEXT_PUBLIC_*` values, then redeploy. In **Authentication → URL Configuration** in Supabase, set the Site URL to your production domain so redirects resolve correctly.

---

## Still to do in phase 2

`02-auth.sql` stops at authentication. The payroll schema — sites, employees, salary structures, attendance, payroll runs, invoices — is specified in [`VEC_BUILD_PROMPT_FINAL.md`](../VEC_BUILD_PROMPT_FINAL.md) §6 and will land as `03-payroll.sql`. The `is_admin()` and `can_access_site()` helpers already exist because every one of those tables' policies will call them.
