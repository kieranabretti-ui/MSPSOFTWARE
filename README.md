# MSP Leak

**Find the work your MSP is doing for free.**

MSP Leak reads the exports an MSP already has (tickets, time entries, users and devices, billing lines and contracts) and finds revenue leakage: out-of-scope work done for free, billable time that never reached an invoice, clients who have grown past their agreement, licences that aren't billed, and clients priced below your target margin. Every finding shows the evidence behind it, a confidence score, an estimated value and a recommended action.

This is a working MVP. It runs from CSV and PDF uploads only; there are no PSA, RMM, accounting or Microsoft 365 integrations yet.

## Try it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **View Demo**. A realistic demo MSP (Northlight IT, 15 clients) is generated, analysed and shown on the dashboard:

| | |
|---|---|
| Potential leakage identified (Apr–Sep 2026) | **£4,281** |
| Recurring leakage | **£356/month** |
| Annualised recurring opportunity | **£4,272** |
| Out-of-scope work | £1,240 · 12 findings |
| Unbilled time | £840 · 17 findings |
| Agreement drift | £1,120 · 6 findings |
| Underpriced clients | £681 · 3 clients |

The remaining £400 comes from one block-hours overage and one unbilled licence, shown under the category cards. Demo data is labelled as such throughout the app and in the report.

The demo is fully interactive: open a finding (try ticket #18492, a personal MacBook set up for a client whose agreement covers company-owned devices only), mark it valid or dismiss it, create and resolve actions, look at client profitability, and download the report as PDF or CSV.

## Running modes

| Mode | When | Accounts and data |
|---|---|---|
| **Local** | No Supabase keys set | Email/password accounts and workspaces are stored in this browser only. Good for demos and evaluation. |
| **Supabase** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set | Supabase Auth (email/password and magic link), Postgres with Row Level Security per workspace, private file storage, and the optional AI review. |

**View Demo** always runs in a local sandbox so the shared demo never touches a real workspace.

### Setting up Supabase

1. Create a Supabase project.
2. Apply the schema. Either paste `supabase/migrations/20261006000000_init.sql` into the SQL editor and run it, or use the CLI:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. In **Authentication → URL configuration**, set the site URL to where the app is served and add `<site>/app` as a redirect URL (used by magic links and email confirmation).
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project settings → API**:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
5. Optional, for the **AI review** card on each finding:
   ```bash
   supabase functions deploy ai-review
   supabase secrets set ANTHROPIC_API_KEY=<your key>
   ```
   The key lives only in the Edge Function. The browser never sees it.

### What the schema does

Tables: `profiles`, `workspaces`, `workspace_members`, `clients`, `contracts`, `tickets`, `time_entries`, `billing_items`, `assets` (users and devices), `uploads`, `analyses`, `findings`, `actions`, `reports`. Every table uses UUID keys and `created_at`/`updated_at` timestamps, and every business table carries `workspace_id`.

Row Level Security is enabled on every table. A user can only read or write rows in workspaces they are a member of. Workspaces are created through the `create_workspace()` function, which also adds the caller as owner, so nobody can insert a workspace or join one directly. Uploaded files go to a private `uploads` bucket under `<workspace_id>/…`, with the same membership check.

The migration has been tested on Postgres 16 with the demo dataset loaded through RLS as a signed-in user, and with a second user confirmed unable to read, change, insert into or join the first user's workspace.

## Uploading your own data

Go to **Data** in the app. Each upload shows a column-mapping step that auto-matches common PSA export headers, previews the rows, and reports rows it had to skip. Clients mentioned in other files but not in the clients file are created automatically.

| File | Required columns | Useful extras |
|---|---|---|
| Clients | client, monthly recurring revenue | contracted users, contracted devices, package, included hours, monthly software cost |
| Tickets | ticket ID, client, date, subject | description, technician, time spent, billable |
| Time entries | date, client, minutes | ticket ID, technician, billable |
| Users & devices | client, type (user/device), name | ownership, licence, status, first seen |
| Billing | client, service, quantity, unit price | monthly value |
| Contracts / SOWs | PDF with selectable text (or pasted text) | |

Dates in ISO or UK format are accepted, money with or without £, and durations as minutes, hours (`1.5h`) or `1h 20m`.

`samples/` contains the whole demo MSP as upload-ready CSVs plus a PDF contract per client. Uploading them through the Data page produces the same £4,281 analysis as the one-click demo. Regenerate them with `npm run samples`.

## How the analysis works

The analysis is a deterministic rules engine (`src/engine/`). The same data always produces the same findings, and every finding links back to the rows it came from. Nothing is sent to an AI model unless someone clicks **Explain this finding**.

| Category | What it checks | How it is valued |
|---|---|---|
| Out-of-scope work | Ticket text matches a kind of work the client's contract excludes (personal devices, hardware repair, projects, onsite visits, new user or device setup, third-party software, out-of-hours work) | Time spent × billable rate (out-of-hours × multiplier) |
| Unbilled time | A billable ticket whose time was logged as non-billable, or work MSPs normally charge for (such as new user setup) logged as non-billable when the contract doesn't include it | Unbilled minutes × billable rate |
| Agreement drift | Active users or devices above the contracted number, month by month | Extra seats × per-seat price from the billing line (or the workspace default) |
| Missing licences | Users assigned a licence beyond the billed quantity | Gap × billed unit price |
| Excessive usage | Support hours above a block-hours allowance plus tolerance | Overage hours × billable rate |
| Underpriced clients | Gross margin (MRR minus labour and software cost) below target | Monthly shortfall against target margin |
| Billing mismatch | A per-user or per-device billing line billing fewer seats than the agreement contracts | Difference × unit price |

Contract clauses are found with pattern rules (`src/engine/contractTerms.ts`) and the matching sentence is quoted and highlighted in the finding. Confidence reflects how strong the text match is and how direct the evidence is. Figures are always presented as **potential** leakage to review, never as money that is definitely recoverable.

Assumptions such as the billable rate (£60/h), labour cost (£35/h), out-of-hours multiplier (1.5×), target margin (30%) and business hours are editable per workspace under **Settings**, and saving re-runs the analysis.

### AI review

`supabase/functions/ai-review` explains a single finding in plain English for an account manager. It sends only that finding and its evidence to Claude, asks for structured JSON, and then checks every quoted excerpt against the evidence: any quote that does not appear verbatim is discarded, so the explanation cannot cite evidence that does not exist. Requests use server-side model fallback, so if the primary model declines a request the API retries it on Anthropic's recommended fallback model. The function runs with the caller's own session, so Row Level Security still applies.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Start the app on port 5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript only |
| `npm test` | Engine tests: the demo must produce exactly the headline figures above |
| `npm run e2e` | Browser smoke test of the demo, findings, actions, reports, sign-up, CSV mapping, PDF contract upload and mobile layout (needs `dev` or `preview` running; set `BASE_URL` if not on 5173) |
| `npm run samples` | Regenerate `samples/` |

CI (`.github/workflows/ci.yml`) runs the type check, tests, build and the browser smoke test on every push.

## Deploying

It is a static single-page app. Build with `npm run build` and serve `dist/` from any static host. `vercel.json` and `public/_redirects` (Netlify) send all routes to `index.html`. Set the two `VITE_SUPABASE_*` variables in the host's environment to enable accounts.

## Project layout

```
src/
  engine/       rules engine, contract clause extraction, work classification
  demo/         seeded demo MSP generator
  data/         CSV importers, local and Supabase backends, app store
  pages/        landing, auth, onboarding, and the app pages
  components/   UI kit, layout, charts
  lib/          formatting, PDF extraction, report builder
supabase/
  migrations/   schema, RLS and storage policies
  functions/    ai-review Edge Function
samples/        demo data as upload-ready CSV and PDF files
scripts/        e2e smoke test, sample generator
```

## Not in this MVP

PSA, RMM, accounting and Microsoft 365 integrations; invoicing and payments; SSO; mobile apps; multiple users per workspace in the UI (the schema already supports members). Pricing on the landing page (£99 / £249 / £499 a month) is marked as planned.
