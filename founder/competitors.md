# Competitors: Headroom

7 October 2026. Public sources only, every fact linked. Raw data: `founder/competitors.csv`.

**In one line:** licence billing reconciliation is crowded and being built into PSAs. Profitability dashboards are crowded too. **Nobody we found checks the work in tickets against what the contract PDF actually covers.** That is Headroom's gap.

## 1. Who is there (most direct first)

| Name | Type | Price (comparable item) | What it sells | Their own line |
|---|---|---|---|---|
| [Gradient MSP Synthesize / Reconcile](https://www.meetgradient.com/synthesize-billing) | Direct | [$199/month Billing Pro](https://www.g2.com/products/synthesize-billing/pricing) | Catches missed licences, wrong quantities and unbilled services across PSA, vendor and distributor data. Integrates Autotask, Kaseya BMS, ConnectWise, HaloPSA, Pulseway, Syncro | "Take the hassle out of reconciling your vendor usage each month" |
| [ScalePad Cognition360](https://www.scalepad.com/cognition360/profitability-analytics) | Direct | [$449/month flat](https://www.capterra.com/p/10021453/Cognition360/) | Agreement, client and project profitability, down to time entries. ConnectWise only | "See which clients, agreements, and projects are actually profitable" |
| [MSPbots Agreement Profitability](https://www.mspbots.ai/agreement-profitability) | Direct | [$179/month per PSA + $29 per admin; $699 BI Unlimited](https://mspbots.ai/pricing) | BI dashboards incl. profit by agreement and margin heat-maps | "Business Intelligence & reporting built for MSPs" |
| [MSPCFO](https://softwarefinder.com/sales-tools/mspcfo) | Direct | $275 Basic, $450 Premium per month | Underpriced contracts, utilisation, fixed-fee agreement metrics. ConnectWise and Autotask. [Pax8 partner](https://www.pax8.com/en-uk/news-post/pax8-and-mspcfo-partner-to-deliver-actionable-business-intelligence-and-profitability-insights-for-msps-worldwide) | not found |
| [BrightGauge](https://www.capterra.co.uk/software/135408/brightgauge) (ConnectWise) | Indirect | from US$316 | KPI dashboards and client reports | not found |
| [Syncro Universal Billing](https://www.businesswire.com/news/home/20250624072008/en/Syncro-Announces-Universal-Billing-to-Eliminate-Missed-Invoices-and-Recover-Lost-Revenue) | Indirect | included in Syncro | Puts marketplace licence data straight onto invoices | "Eliminate Missed Invoices and Recover Lost Revenue" |
| [Rewst](https://rewst.io/blog/mastering-billing-reconciliation-automation-an-msps-guide-to-success/) | Indirect | not stated | Automation workflows incl. vendor-to-PSA billing sync | "Ask, Automate, Deliver" |
| [Thread](https://docs.getthread.com/skill-library/finance-and-billing/license-billing-reconciliation.md) | Indirect | not checked | Licence billing reconciliation as one skill in its library | not checked |
| [HaloPSA](https://superops.com/blog/halopsa-pricing) own reports | Substitute | already paid for ($95 to $115 per agent) | The MSP builds its own contract reports | |
| [Spreadsheets at month end](https://www.meetgradient.com/resources/are-you-leaking-revenue) | Substitute | staff time | Owner compares vendor reports, contracts and invoices by hand | |
| [UK fractional finance director](https://www.fdcapital.co.uk/how-much-does-a-uk-fractional-fd-cost/) | Substitute | £3,000 to £5,600 a month (1 day a week) | A person reviews margins and pricing | |

## 2. Price range (monthly software, comparable tier)

Lowest **$179** (MSPbots BI, one PSA, before admin seats). Median **$316** (BrightGauge). Highest **$699** (MSPbots BI Unlimited; $990 with the Pro Bundle). Headroom's planned Starter £99 sits below all of them. Growth at £249 sits near the median. I didn't check today's exchange rate, so that comparison is approximate. Every tool found prices in US dollars. None is UK-based (inferred from the listings).

## 3. Positioning map

Two axes that matter to an MSP owner. **Across:** what it checks, from *licence and vendor billing* to *profit by agreement* to *the work done versus what the contract covers*. **Down:** effort to get a first answer, from *a person does it* through *upload and go* to *weeks of integration and dashboard setup*.

```
                    licences/vendor        profit by agreement        work vs contract
                    -----------------      -------------------        ----------------
person does it                              fractional FD ...................(covers all, £3k+/mo)
upload and go                                                          HEADROOM (alone here)
built into PSA      Syncro Universal Billing   HaloPSA reports
integration,        Gradient, Rewst,           Cognition360, MSPCFO,
setup weeks         Thread                     MSPbots, BrightGauge
```

The left and middle columns are full. The right column has only Headroom and a human finance director.

## 4. What their customers complain about

Public reviews are **thin** for this category. Gradient, Cognition360 and MSPCFO each show 0 reviews on the sites checked ([G2](https://www.g2.com/sellers/gradient-msp), [Capterra](https://www.capterra.com/p/10021453/Cognition360/), [Software Finder](https://softwarefinder.com/sales-tools/mspcfo)). Every theme below has fewer than three reviews behind it, so treat them as hints, not findings.

1. **Setup effort and learning curve (thin, 3 mentions).** MSPbots: needs "a few weeks getting the dashboards exactly how you want them" and has a steep learning curve for non-technical managers ([tooliverse summary](https://tooliverse.ai/tools/mspbots)). BrightGauge: "It doesn't feel fluid to use" ([Capterra UK](https://www.capterra.co.uk/reviews/135408/brightgauge)).
2. **Price for small shops (thin, 2 mentions).** MSPbots: "hard to swallow for a 3-man shop" ([tooliverse](https://tooliverse.ai/tools/mspbots)). BrightGauge: "pricing structure can be a bit confusing, with different plans and add-ons that can quickly add up" ([Capterra UK](https://www.capterra.co.uk/reviews/135408/brightgauge)).
3. **Not enough data depth (thin, 2 mentions).** BrightGauge: "I wish you had access to more data, in terms of how far back it goes" ([Capterra UK](https://www.capterra.co.uk/reviews/135408/brightgauge)).
4. **Support after acquisition (thin, 1 mention).** BrightGauge: "Since the product was acquired by ConnectWise, we have seen a decrease in the level of support" ([Capterra UK](https://www.capterra.co.uk/reviews/135408/brightgauge)).

The r/msp threads I hoped to read didn't come up in search, so owners' own words about scope creep are still missing. `/founder-consumer` should test that directly.

## 5. The gap

**Checking the work done against what the contract covers, with the clause and the ticket side by side.**
- The billing tools (Gradient, Syncro, Rewst, Thread) match licence counts between vendors and the PSA. They don't read the agreement or judge whether a ticket was in scope.
- The profitability tools (Cognition360, MSPbots, MSPCFO) show *which* agreement loses money. Cognition360 goes deepest, down to time entries, but it is ConnectWise-only and none of them claims to read the contract itself.
- The owner is left to do the "was this covered?" judgement by hand, or pay a finance director £3,000+ a month.

The evidence supports the board's advice: **lead with out-of-scope work and agreement drift**. Unbilled licences should be a supporting feature only. Gradient already owns that space, and Syncro gives it away free inside the PSA.

Two more openings, both inferred:
- **Low setup effort.** Every software competitor needs a live PSA integration, and the reviews complain about setup. Headroom's upload-and-go route, plus a guided audit, is a real contrast. Integrations are still needed later.
- **UK and pounds.** Every tool found prices in US dollars and none appears UK-based. A UK-first product in pounds with UK data hosting could be a small but real edge.

**What is not a gap:** the "revenue leakage" message. Gradient already uses it, claims MSPs lose "somewhere between 3% - 10% of total revenue" ([Gradient](https://www.meetgradient.com/resources/are-you-leaking-revenue)) and gives money-loss stories. Headroom needs to sound different: "the work your MSP is doing for free" is about scope, which is the right place to stand.

## 6. The threat: who could copy Headroom fastest

1. **Gradient.** It already owns the "leakage" story, sells to the same buyer and integrates with the six main PSAs, HaloPSA included. Adding an AI check of tickets against contract PDFs is a feature for them, not a new company.
2. **The PSAs themselves (HaloPSA, ConnectWise, Syncro).** They hold the tickets and the contracts. Syncro has already turned licence reconciliation into a free built-in feature.
3. **MSPbots.** It has AI products and agreement profitability already. "Why is this agreement unprofitable?" with a scope check is a natural next step.

Headroom's defence is speed and focus on the one job. Over time it is the benchmark from many real audits ("a typical UK MSP gives away X% in out-of-scope work"), which a copycat can't build quickly.

## Next

- `/founder-consumer` turns these complaints and the gap into real objections and tests them on simulated MSP owners.
- `/founder-pricing` uses the $179 to $699 range.
