# Board brief: Headroom

This brief stands on its own. It is the founder's idea plus the facts recorded about the project so far. It contains no opinion of the idea.

## The idea

- What it is: web software that reads the exports a managed service provider (MSP) already has (tickets, time entries, users and devices, billing lines, contract PDFs) and finds revenue leakage, with the evidence and calculation behind every pound. Tagline: "Find the work your MSP is doing for free."
- Who it is for: owners and commercial leads of UK MSPs (IT support businesses of roughly 5 to 50 staff, about £1m to £5m revenue) that run clients' IT on monthly agreements. They are typically ex-technicians, short on time and sceptical of vendors.
- What it sells, at what price: a free self-serve "Revenue Leakage Audit" (account plus first analysis), then planned monthly plans: Starter £99 (up to 25 clients, proposed), Growth £249 (up to 100 clients, proposed, the recommended tier) and Pro £499 (unlimited). Pricing is planned, not live.
- Where and how: online SaaS. Data arrives as CSV and PDF uploads; no PSA, RMM, accounting or Microsoft 365 integrations yet. How customers will find it is not yet decided.
- Budget and constraints: solo founder trading through his UK limited company. Budget not stated.

## What the product does today (a working MVP)

It finds five kinds of leakage:
- out-of-scope work done for free (work in tickets that the client's agreement does not cover)
- billable time that never reached an invoice
- clients who have grown past their agreement (more users or devices than contracted)
- licences and recurring charges that aren't billed
- clients priced below the MSP's target margin

Every opportunity shows its evidence (the ticket, time entry or contract clause), how its value was calculated, a confidence level (High, Medium or Low) with the reason, and a recommended action. Opportunities move through New, Reviewing, Approved and Actioned. Figures are always presented as potential leakage to review, never as money definitely recoverable. Reports download as PDF or CSV.

The founder's intended direction: start with leakage detection ("find the work your MSP is doing for free") and grow into a broader "commercial intelligence for MSPs" category: profitability, contract optimisation, scope management, pricing, billing reconciliation, forecasting and automated change orders. It is deliberately not sold as an AI tool, a dashboard or a reporting tool.

## The demo

A fictional MSP (Northlight IT, 15 clients) with six months of data (April to September 2026). The engine finds:

| | |
|---|---|
| Potential leakage identified | £4,281 (about 2.9% of billing) |
| Recurring leakage | £356 a month |
| Annualised recurring | £4,272 |
| One-off | £2,435 |
| Out-of-scope work | £1,240, 12 opportunities |
| Unbilled work | £840, 17 opportunities |
| Agreement drift | £1,120, 6 opportunities |
| Underpriced clients | £681, 3 clients |

£336 of the total overlaps between one client's margin finding and its user drift. This is disclosed but still counted in the headline.

## Where things stand (7 October 2026)

- An independent QA review scored the product 78/100 and answered "YES, WITH CHANGES" to "would an MSP owner pay £249 a month?"
- No customers, design partners, testimonials or recorded conversations with MSP owners yet. No audit has been run on a real MSP's data.
- The live site runs in browser-only evaluation mode until the backend keys are added.
- Not yet in place: privacy policy, terms, data processing agreement, MFA, multi-user workspaces, a human or guided audit route, PSA export guides.
- Brand system, landing page, security page (candid about what isn't in place yet) and funnel tracking are done.
