# Headroom methodology

How Headroom turns your exports and agreements into findings, how every figure is calculated, how confidence and classification are decided, and what AI is and is not allowed to do.

The short version: findings come from comparing your own operational, contractual and billing records. Financial calculations are deterministic. AI may help explain a finding, but it never produces or changes a number. Every finding should be reviewed by you before any billing or contractual change. The software recommends; the MSP decides.

The code is the source of truth. This document describes `src/engine/analyse.ts` (rules), `src/engine/contractTerms.ts` (contract clauses), `src/engine/confidence.ts` (confidence and classification), `src/lib/calculation.ts` (the calculation shown with each finding) and `src/engine/money.ts` (rounding). Known-answer tests in `src/engine/knownAnswers.test.ts` check each rule against hand-worked figures.

## 1. Inputs and traceability

| Source | What is read | Evidence source label |
| --- | --- | --- |
| Agreements (uploaded contract text) | Exclusions and chargeable work, support hours, included hours, contracted users and devices, hourly rate and out-of-hours multiplier | `agreement` |
| Clients file | Monthly recurring revenue, contracted users and devices, included hours, software cost | `client_record` |
| Tickets and time entries (PSA exports) | Subject, description, date, technician, minutes, billable flag | `psa` |
| Users and devices export | Active users and devices, licence, first-seen date | `asset_register` |
| Billing export | Recurring lines: service, quantity, unit price | `billing` |
| Settings | Billable rate, labour cost, default prices, target margin, business hours, usage tolerance | `settings` |
| Computed | Monthly totals built from the records above | `derived` |

The clients file is your own spreadsheet, not the signed agreement, so a figure taken from it is labelled "Client record · clients file", never "Agreement".

Every imported row keeps its provenance: the upload it came from, the file name and its row number (the header is row 1). A re-upload that updates a record replaces its provenance with the latest file and row. Contract clauses keep the contract they came from, the section number they sit under (for example 3.1, inherited from the nearest numbered heading) and the page, when the stored text kept page breaks.

Each finding carries:

- **Evidence lines**, each with its source system and references (`refs`) to every record it was read from: ticket, time entries, users, devices, billing lines, the client record and contract section. Settings lines name the Settings keys used.
- **Source records** (`source_data`): every record any evidence line points at.
- **Claims**, kept apart by type (see section 5).
- **Calculation inputs** (`meta.calc`), from which the calculation shown in the app is rebuilt rather than restated.

## 2. Rules

All rules run over the analysis period: the months spanned by the ticket and time-entry dates.

| Rule | Category | Fires when | Value |
| --- | --- | --- | --- |
| `out_of_scope.<work>` | Out of scope | A ticket's wording matches a kind of work (personal device, hardware repair, third-party application, project, onsite, new user, new device, out of hours) and the client's agreement has a clause excluding it or making it chargeable, and the time was logged as non-billable | One-off: non-billable time × hourly rate |
| `unbilled.billing_mismatch` | Unbilled time | The ticket is marked billable but time against it is non-billable | One-off: non-billable time × hourly rate |
| `unbilled.<work>` | Unbilled time | The wording matches typically chargeable work, no agreement clause says it is included, and the time is non-billable | One-off: non-billable time × hourly rate |
| `mismatch.user` / `mismatch.device` | Recurring charge mismatch | The per-unit billing line bills fewer than the contracted quantity | Recurring: (contracted − billed) × line price |
| `recurring.missing_user` / `recurring.missing_device` | Recurring charge mismatch | A contracted quantity exists, the client has billing lines, but none is a per-unit charge | Recurring, as a guide only: contracted × Settings default price |
| `drift.user` / `drift.device` | Agreement drift | More active users or devices than contracted (or billed, when no contracted figure exists) | Recurring: (active − contracted) × unit price |
| `license.unbilled` | Missing licence | More users are assigned a licence than the matching billing line bills | Recurring: (assigned − billed) × line price |
| `usage.over_allowance` | Excessive usage | Non-billable hours in a month exceed the included hours by more than the Settings tolerance | One-off per month: (hours − included) × hourly rate |
| `margin.below_target` | Underpriced client | No included hours, the client has MRR, and its modelled margin is below target | Estimate: monthly shortfall against the target margin |

Details that matter:

- **Ticket time.** Time entries linked to a ticket are used; a ticket without entries uses its own minutes and billable flag. A ticket imported twice is counted once.
- **Hourly rate.** The rate stated in the client's agreement when it states exactly one rate (and, for out-of-hours work, one multiplier); otherwise the Settings billable rate and multiplier. If the agreement states two different rates, neither is used.
- **Support hours.** Out-of-hours work is judged against the agreement's support window when its clause states the same hours as Settings; otherwise against Settings alone.
- **Contracted quantity.** The figure stated in an uploaded agreement ("based on 39 supported users") when the agreement states exactly one; otherwise the clients file; otherwise, for drift only, the billed quantity. When the agreement and clients file disagree, the agreement's figure is used and the disagreement is recorded.
- **Per-unit price line.** Lines named per user or seat (or per device, endpoint, workstation), excluding any line named exactly like a licence your users hold. If several remain, lines named support, managed or monitoring are preferred. If several still remain, the lowest price is used and the price is marked ambiguous.
- **Licence matching.** A licence matches a billing line when the names are identical once case and punctuation are ignored. A partial match (one name contains the other) is used only when it is the single candidate for that line and that licence; otherwise no finding is raised.
- **Drift timing.** Only assets present by the end of the period count. Each month counts the assets first seen by that month's end; an asset with no first-seen date counts from the first month, and is disclosed.
- **Usage.** Only non-billable time counts against the allowance, because billable time is charged separately.
- **Margin.** Contribution = MRR − all logged hours × labour cost − software cost (clients file, or users × the Settings default per user). Shortfall per month = target margin × MRR − contribution, where positive. The target price is average cost ÷ (1 − target margin). When billing the client's agreement gaps alone would restore the target margin, the overlap is disclosed and neither figure is netted.

## 3. Calculations and rounding

Every finding's calculation is shown as lines a reader can check by hand, for example:

```
47 active users − 39 contracted = 8 users
8 × £82 (Managed Support (per user)) = £656 a month
£656 × 12 = £7,872 a year
```

- Recurring figures are calculated unrounded and rounded once, to the penny: monthly = count × price; annual = that unrounded monthly × 12. Three extra users at £8.50 are £25.50 a month and £306 a year.
- The period total for a recurring finding is the sum of each month's value in the period, so it reflects when users, devices or licences were added.
- One-off time findings are rounded to the nearest pound per ticket. Usage is rounded to the nearest pound per month.
- The margin estimate's monthly figure is the period shortfall ÷ months, rounded to the nearest pound, and is annualised from that rounded figure. This keeps the published demo totals stable; it is labelled an estimate and is never in the high-confidence total.
- No figure anywhere is produced or adjusted by AI.

## 4. Confidence

Confidence reflects the strength and completeness of the underlying evidence. It is derived in `src/engine/confidence.ts` from explicit checks recorded with each finding; the app, reports and exports read the same function. The level, a plain-English basis and the list of checks (met or not) are shown together.

| Level | Meaning |
| --- | --- |
| **High** | Direct evidence in your records on both sides of the comparison, and a deterministic calculation with no defaulted inputs. |
| **Medium** | Your records support it, but an input is assumed (a Settings price, rate or hours, or the clients file rather than the agreement) or a person needs to check something the data cannot show. |
| **Low** | The evidence is incomplete or ambiguous, or the value is modelled rather than counted. |

Per rule:

| Rule | High when | Otherwise |
| --- | --- | --- |
| Out of scope | Agreement clause matched, strong wording match, hourly rate from the agreement, and (out of hours) support hours from the agreement | Medium |
| Unbilled, billing mismatch | Never: the time may be a deliberate write-off | Medium |
| Unbilled, chargeable-looking work | Never: nothing confirms it is chargeable | Low |
| Recurring mismatch | Contracted quantity stated in an agreement, and one unambiguous per-unit line | Medium |
| Missing recurring charge | Never: it may be bundled in another line | Low |
| Drift | Contracted quantity from an agreement that the clients file does not contradict, priced at one unambiguous billing line, all assets dated | Medium |
| Licence | Licence and billing line names identical | Medium |
| Usage | Never: invoices are not in the data, so the overage may already be billed | Medium when the allowance is in the agreement; Low when it comes from the clients file only |
| Margin | Never: a modelled estimate | Low |

The stored 0 to 100 score exists only for older readers; it is set to the level's band midpoint (High 95, Medium 80, Low 50) and must not be shown or exported. Findings saved before calculation inputs were recorded fall back to that score and say "Run the analysis again".

## 5. Claims and classification

Each finding's statements are kept apart:

- **Fact**: read directly from a record ("Your users list shows 47 active users").
- **Observation**: a deterministic comparison or calculation of facts ("47 − 39 = 8 users more than contracted").
- **Interpretation**: what it may mean, including the alternatives ("Some may be leavers not yet removed"). Keyword matches and clause matches are interpretations. AI-assisted text is always an interpretation and is labelled AI-assisted.
- **Recommendation**: what the MSP could do, always framed as a review step.

Classification:

| Classification | Rule |
| --- | --- |
| **Confirmed discrepancy** | High confidence, and a pure record-against-record discrepancy: drift, recurring mismatch, licence |
| **Potential opportunity** | Medium confidence; or High where acting still needs judgement (out-of-scope work: whether to charge it is the MSP's decision) |
| **Investigation required** | Low confidence, or any modelled estimate |

No finding says a client owes money. Wording is "evidence-backed opportunity", "potential opportunity" or "requires review".

## 6. Conservative mode

Headline figures are split so uncertainty is never blended in silently:

- **High confidence**: the sum of High findings only. Shown first.
- **Requires review**: the sum of Medium and Low findings, including all estimates.
- **Total potential**: their sum, always labelled as such and never shown as the lead figure on its own.

`confidenceSplit()` in `src/lib/confidence.ts` computes this from the findings so every surface uses the same split. Severity is a priority hint from value and confidence; only High-confidence findings can reach the top band.

## 7. What AI may and may not do

AI is optional. It runs only in hosted mode with AI configured on the server (`supabase/functions/ai-review`), and only when you ask for an explanation of one finding.

AI may:

- explain an existing finding in plain English, using only the finding and its evidence, as a potential opportunity;
- quote evidence, with quotes checked word for word against the evidence before they are shown.

AI may not:

- produce, change or round any figure, total, percentage, annualisation or comparison;
- create, dismiss or reclassify a finding, or change its confidence;
- be shown without an "AI-assisted" label.

Contract terms and ticket types are identified by the deterministic rules described above, not by AI.

## 8. Known limits

- Ticket classification and clause extraction are keyword rules; they can miss or mis-read unusual wording. That is why keyword matches are interpretations and out-of-scope findings are never "confirmed".
- Invoices are not part of the data, so a charge raised outside the recurring billing lines (an overage or a one-off invoice) cannot be seen.
- The margin model treats all logged time as cost against the monthly fee, including billable time charged separately.
- Page numbers are available only when the stored contract text kept page breaks.
