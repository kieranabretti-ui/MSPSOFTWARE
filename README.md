# Headroom

**Find the work your MSP is doing for free.**

Headroom reads the exports an MSP already has (tickets, time entries, users and devices, billing
lines and contracts) and finds revenue leakage: out-of-scope work done for free, billable time that
never reached an invoice, clients who have grown past their agreement, licences that aren't billed,
and clients priced below your target margin. Every opportunity shows the evidence behind it, how its
value was calculated, a confidence level (High, Medium or Low) with its basis, an estimated value and a
recommended action. Figures are always presented as **potential**
leakage to review, never as money that is definitely recoverable.

This is a working MVP. It runs from CSV and PDF uploads only; there are no PSA, RMM, accounting or
Microsoft 365 integrations yet.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and click **Explore the demo**. A demo MSP (Northlight IT, 15 clients,
fictional) is generated, analysed and shown on the dashboard:

| | |
|---|---|
| Potential leakage identified (Apr–Sep 2026) | **£4,281** |
| Recurring leakage | **£356 a month** |
| Annualised recurring opportunity | **£4,272** |
| Out-of-scope work | £1,240 · 12 opportunities |
| Unbilled work | £840 · 17 opportunities |
| Agreement drift | £1,120 · 6 opportunities |
| Underpriced clients | £681 · 3 clients |

The remaining £400 comes from one block-hours overage and one unbilled licence. Demo data is labelled
as such throughout the app and in the report.

The demo is fully interactive: open an opportunity (try ticket #18492, a personal MacBook set up for a
client whose agreement covers company-owned devices only), move it from New through Reviewing and
Approved to Actioned or dismiss it, work the recovery queue, look at client profitability, and download
the report as PDF or CSV.

The landing page's **Get a Free Revenue Leakage Audit** opens sign-up (`/signup?intent=audit`). The free
audit is a self-serve account plus its first analysis; from inside the demo the button ends the demo
first. Pricing is Free audit (£0), Growth (£240 a month or £2,592 a year) and Pro (£500 a month or
£5,400 a year, sales-led), all ex VAT. `src/billing/plans.ts` is the source of truth for every plan,
price, limit and term; no component writes a price of its own, and `npm test` fails if one does.
Checkout isn't built, so paid-plan buttons record interest and every account has the whole product.

## Running modes

| Mode | When | Accounts and data |
|---|---|---|
| **Local** | No Supabase keys set | Email/password accounts and workspaces are stored in this browser only. Good for demos and evaluation. |
| **Supabase** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set | Supabase Auth (email/password and magic link), Postgres with Row Level Security per workspace, private file storage, and the optional AI review. |

**Explore the demo** always runs in a local sandbox, so the shared demo never touches a real workspace.

### Setting up Supabase

1. Create a Supabase project (the hosted project for this app is in the London region).
2. Apply every migration in `supabase/migrations/`, in filename order. With the CLI:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   or paste each file into the SQL editor in order. `20261008000100_tenant_hardening.sql` must run
   after `20261008000000_evidence_and_audit.sql`.
3. Run the isolation checks: paste `supabase/tests/rls.sql` into the SQL editor (or
   `psql "$DB_URL" -f supabase/tests/rls.sql`). It creates two throwaway users and workspaces inside
   a transaction, prints `PASS …` for each check and rolls everything back. Any `FAIL …` aborts. Run
   it on a staging project first, and again after every migration.
4. In **Authentication → URL configuration**, set the site URL to where the app is served and add
   `<site>/app` as a redirect URL (used by magic links and email confirmation).
5. In **Authentication**, mirror `supabase/config.toml` (it only applies to a local `supabase start`):
   - confirm email: on;
   - minimum password length 10, with lower and upper case letters and digits;
   - leaked password protection: on (hosted projects only);
   - secure email change: on.
6. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from
   **Project settings → API**:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   The anon key is public by design; Row Level Security protects the data. Never put the
   `service_role` key in a `VITE_` variable or anywhere in the frontend.
7. Optional, for the **AI review** card on each finding:
   ```bash
   supabase functions deploy ai-review
   supabase secrets set ANTHROPIC_API_KEY=<your key>
   supabase secrets set SITE_URL=https://<your app origin>
   # optional limits (defaults shown)
   supabase secrets set AI_WORKSPACE_DAILY_LIMIT=50 AI_USER_HOURLY_LIMIT=20 AI_USER_DAILY_LIMIT=60
   ```
   `SITE_URL` may list several origins separated by commas. If it is unset, the function refuses
   every browser origin (it allows `localhost` only when running against a local Supabase). The
   Anthropic key and the service role key (provided to Edge Functions by Supabase) live only in the
   function. The browser never sees them.

### What the schema does

Tables: `profiles`, `workspaces`, `workspace_members`, `clients`, `contracts`, `tickets`,
`time_entries`, `billing_items`, `assets` (users and devices), `uploads`, `analyses`, `findings`,
`actions`, `reports`, `audit_log`, `ai_usage`. Every table uses UUID keys and timestamps, and every
business table carries `workspace_id`.

## Security setup and controls

What is enforced, and where. Each line is checked by `supabase/tests/rls.sql` unless it says
otherwise. These controls apply to **Supabase mode only**: in local mode everything stays in the
browser's storage, the sign-in is not a security boundary, and anyone using the same browser profile
can read the data.

- **Tenant isolation (Row Level Security).** RLS is on for every table. A user can read or write
  rows only in workspaces they belong to. Workspaces are created through `create_workspace()` (one
  per user), which adds the caller as owner, so nobody can insert a workspace or join one directly.
- **References stay inside a workspace.** Foreign keys from child rows to clients, uploads,
  analyses and findings are composite `(workspace_id, id)` keys, so a row in workspace A cannot point
  at a record in workspace B (foreign-key checks bypass RLS, so this has to be enforced by the keys
  themselves). A row's `workspace_id` cannot be changed after it is written.
- **Signed-out callers get nothing.** The `anon` role has no privileges on any table or function.
  New tables get no default grants: each migration must grant what it needs.
- **Files.** The `uploads` bucket is private, accepts only PDF and plain text up to 20 MB, and only
  under `<workspace_id>/…` for members of that workspace. Files cannot be overwritten.
- **AI output is written by the server.** `findings.ai_explanation` and `ai_meta` (model, time,
  evidence hash) can only be written by the `ai-review` function. When a finding's evidence or
  values change, the database clears its old explanation.
- **AI limits.** Each request is recorded in `ai_usage`; the function enforces a per-workspace daily
  cap and per-user hourly and daily caps, and reuses a stored explanation for unchanged evidence.
- **Audit log.** Append-only: members can read and add events for their own workspace, never edit
  or delete them. Deletions and AI explanations are logged by the server, and members cannot add
  those events themselves. The actor's email is taken from their account.
- **Deletion.** `delete_upload`, `delete_analysis`, `clear_workspace_data`, `delete_workspace` and
  `delete_my_account` run as single transactions and check membership (ownership for workspace and
  account deletion).
- **Browser.** `public/_headers` sets an enforced Content Security Policy (scripts
  from this site only, no inline script, no eval), `X-Frame-Options: DENY`, HSTS, `nosniff` and a
  strict referrer policy, verified against the built app with zero violations. `vercel.json` must
  carry the same values for Vercel deployments. If you set `VITE_TRACK_ENDPOINT` to another origin,
  add it to `connect-src` in both files.
- **Exports.** Every CSV is written through `src/lib/csvSafe.ts`, which neutralises cells that a
  spreadsheet would run as formulas.
- **Uploads in the browser.** CSV: `.csv`/`.txt` only, at most 25 MB, binary files refused, row cap
  in local mode. Contracts: PDF (checked by its file signature) or `.txt`, at most 20 MB and 500
  pages; scanned PDFs without text are refused.

Not in place (roadmap, not claims): MFA, SSO, multiple users per workspace in the UI, a penetration
test, SOC 2 or ISO 27001, customer-managed keys, and running the analysis on the server (findings'
figures are computed in the browser and stored by the signed-in user, so a member could alter their
own workspace's stored figures through the API).

Security contact: set `COMPANY.securityEmail` in `src/brand/brand.ts`; the `/security` page shows it.

## Uploading your own data

Go to **Data** in the app. Each upload shows a column-mapping step that auto-matches common PSA
export headers, previews the rows, and reports rows it had to skip. Clients mentioned in other files
but not in the clients file are created automatically.

| File | Required columns | Useful extras |
|---|---|---|
| Clients | client, monthly recurring revenue | contracted users, contracted devices, package, included hours, monthly software cost |
| Tickets | ticket ID, client, date, subject | description, technician, time spent, billable |
| Time entries | date, client, minutes | ticket ID, technician, billable |
| Users & devices | client, type (user/device), name | ownership, licence, status, first seen |
| Billing | client, service, quantity, unit price | monthly value |
| Contracts / SOWs | PDF with selectable text (or pasted text) | |

Dates in ISO or UK format are accepted, money with or without £, and durations as minutes, hours
(`1.5h`) or `1h 20m`.

`samples/` contains the whole demo MSP as upload-ready CSVs plus a PDF contract per client. Uploading
them through the Data page produces the same £4,281 analysis as the one-click demo. Regenerate them
with `npm run samples`.

## How the analysis works

The analysis is a deterministic rules engine (`src/engine/`). The same data always produces the same
findings, and every finding links back to the rows it came from. Nothing is sent to an AI model
unless someone clicks **Explain this opportunity**. The `/security` page sets out what is and isn't in
place, in sentences the code backs.

| Category | What it checks | How it is valued |
|---|---|---|
| Out-of-scope work | Ticket text matches a kind of work the client's contract excludes (personal devices, hardware repair, projects, onsite visits, new user or device setup, third-party software, out-of-hours work) | Time spent × billable rate (out-of-hours × multiplier) |
| Unbilled time | A billable ticket whose time was logged as non-billable, or work MSPs normally charge for (such as new user setup) logged as non-billable when the contract doesn't include it | Unbilled minutes × billable rate |
| Agreement drift | Active users or devices above the contracted number, month by month | Extra seats × per-seat price from the billing line (or the workspace default) |
| Missing licences | Users assigned a licence beyond the billed quantity | Gap × billed unit price |
| Excessive usage | Support hours above a block-hours allowance plus tolerance | Overage hours × billable rate |
| Underpriced clients | Gross margin (MRR minus labour and software cost) below target | Monthly shortfall against target margin |
| Billing mismatch | A per-user or per-device billing line billing fewer seats than the agreement contracts | Difference × unit price |

Contract clauses are found with pattern rules (`src/engine/contractTerms.ts`) and the matching
sentence is quoted and highlighted in the finding. Confidence reflects how strong the text match is
and how direct the evidence is.

Assumptions such as the billable rate (£60/h), labour cost (£35/h), out-of-hours multiplier (1.5×),
target margin (30%) and business hours are editable per workspace under **Settings**, and saving
re-runs the analysis.

### AI review

`supabase/functions/ai-review` explains a single finding in plain English for an account manager. It
sends only that finding and its evidence to Claude, asks for structured JSON, then checks every
quoted excerpt against the evidence: any quote that does not appear verbatim is discarded, so the
explanation cannot cite evidence that does not exist. Requests use server-side model fallback, so if
the primary model declines a request the API retries it on Anthropic's recommended fallback model.
The function reads the finding with the caller's own session, so Row Level Security decides
whether they can see it. Uploaded text is XML-escaped and wrapped in a single `<data>` element that
the prompt marks as untrusted data, never instructions. The answer is refused if it contains a
number that is not already in the finding or its evidence (the model may not calculate) or wording
that claims money is owed. The checks live in `supabase/functions/ai-review/guard.ts` and are tested
in `src/lib/aiGuard.test.ts`.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Start the app on port 5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run build:preview` | Build a self-contained preview to `dist-preview/`: it opens straight into the demo, keeps routes in memory so any static host works without rewrites, and turns off file downloads |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest: the engine must produce exactly the headline figures above, the brand tokens in `src/brand/tokens.ts` must match `brand/brand-tokens.css`, and the landing page's demo snapshot must match the engine |
| `npm run e2e` | Browser smoke test of the landing page, the demo, opportunities, the recovery queue, reports, sign-up, CSV mapping, PDF contract upload, mobile layout and leaving the demo for the free audit (needs `dev` or `preview` running; set `BASE_URL` if not on 5173) |
| `npm run samples` | Regenerate `samples/` |

CI (`.github/workflows/ci.yml`) runs the type check, tests, build and the browser smoke test on every
push and pull request, and uploads screenshots when the smoke test fails.

## Brand system

The brand is tokenised, so a token change restyles the app, the report and the marketing page at
once.

- **`brand/brand-guidelines.md`** — read this first: positioning, voice, colour, type, logo, icons,
  charts, UI language and the decisions behind them.
- `brand/brand-tokens.css` — the source of truth for colour, type, radius, shadow and motion,
  including the paper (print and PDF) set.
- `src/styles/theme.css` — those tokens mapped onto Tailwind utilities (`bg-surface`, `text-ink-2`,
  `border-line`). Components use these names, never raw colours.
- `src/brand/tokens.ts` — the same colours as hex, for charts and the PDF. `npm test` fails if they
  drift from the CSS.
- `src/brand/Logo.tsx`, `brand/logo/`, `brand/favicons/`, `brand/social/`, `brand/icons/` — the mark,
  the lockup and the exported assets (the shipping favicons and sharing image live in `public/`).
- `brand/naming.md` — how the product came to be called Headroom.

## Deploying

A static single-page app. Build with `npm run build` and serve `dist/` from any static host.
`vercel.json` and `public/_redirects` (Netlify) send all routes to `index.html`; `vercel.json` and
`public/_headers` set the security headers (see "Security setup and controls"). Set the two
`VITE_SUPABASE_*` variables in the host's environment to enable accounts; leave them unset to deploy
in local mode.

## Project layout

```
src/
  engine/       rules engine, contract clause extraction, work classification
  demo/         seeded demo MSP generator
  data/         CSV importers, local and Supabase backends, app store
  pages/        landing, auth, onboarding, and the app pages
  components/   UI kit, layout, charts
  brand/        logo, icon set, brand constants, token mirror
  styles/       brand tokens mapped to Tailwind
  lib/          formatting, PDF extraction, report builder
  billing/      pricing config (plans.ts), entitlements and billing state rules
brand/          tokens, guidelines, naming, logo and exported assets
supabase/
  migrations/   schema, RLS and storage policies
  functions/    ai-review Edge Function
samples/        demo data as upload-ready CSV and PDF files
scripts/        e2e smoke test, sample generator
```

## Not in this MVP

PSA, RMM, accounting and Microsoft 365 integrations; invoicing and payments; SSO; mobile apps;
multiple users per workspace in the UI (the schema already supports members). Online checkout and plan
enforcement: prices are set in `src/billing/plans.ts` and the billing rules in
`src/billing/entitlements.ts`, but no payment processor is connected and `BILLING_LIVE` is false.
