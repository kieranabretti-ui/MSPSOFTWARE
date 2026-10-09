# CFO: Headroom

Updated 9 October 2026. **Kieran takes no salary from Headroom in year 1**, so this is the main case. Prices are the locked ones: Growth £240 a month + VAT. Revenue below is before VAT (UK VAT at 20% is added on top and passed to HMRC). The model counts Growth only, so Pro is upside. **Not financial, tax or legal advice: an accountant should check the structure and tax before money moves.**

The tool's "per day" is used here as "per month": one unit is one paying customer for one month. Inputs are in `founder/numbers.json`. The salaried comparison is kept in `founder/numbers-founder-salary.json`. Sources are in `founder/cfo-sources.md`.

## The CFO's note

**The margin.** Each paying customer leaves **£228 a month (95%)** after card fees, hosting, AI and tools. With no salary, fixed costs are **£1,060 a month** (platform £60, plus about £1,000 of software, accounting, insurance and a little marketing, which is an estimate).

**Year 1:**
- **Break-even: 5 paying customers.** At the planned ramp that is reached in **month 6**.
- **Year 1 operating profit: +£5,043** on £18,696 of revenue, and **+£2,641** after the £2,402 startup spend.
- **Cash needed before it pays for itself: about £5,700.** The low point is month 5.
- **Startup money earned back: month 11.**

**The line to watch: the conversion from free audit to paid.** The ramp assumes 4 to 12 guided audits a month, 15% of them becoming paying customers (between the panel's 10% at £240 and 25% at £99), paying from the month after signing (the founding 30 days free), with 3% monthly churn. That gives 14 paying customers by month 12.
- At **10%** (the panel's figure at £240): year 1 is **-£872**, and the startup money isn't earned back in year 1.
- At **25%**: year 1 is **+£16,891**, and it pays back in **month 8**.

**Three ways to improve it** (what-ifs run with the tool):
1. **Raise conversion to 25%.** Year 1 rises from +£5,043 to **+£16,891**, with payback in month 8 instead of 11. Measure it from the first 10 audits.
2. **Sell Pro to 1 in 10.** At a blended £279 a month, break-even drops to **4 customers** and year 1 rises to **+£8,081**.
3. **More audits.** Twice the volume gives a year 1 of **+£22,806**. Audits are founder time, so the capacity limit is the next thing to watch.

Not worth chasing: unit costs. Costs up 15% moves year 1 by only £140.

**Capacity.** The pricing model puts one founder at about 25 customers plus the audits. That isn't reached in year 1 at this ramp (14 customers), so no hire is needed in year 1.

**For reference: with a £60k salary** the same plan breaks even at 38 customers and loses £87,359 in year 1. That's kept in `numbers-founder-salary.json` for when a salary is worth revisiting. 38 customers at this ramp is about month 36 (inferred).

**The board's money conditions** (`founder/board.md`):
- Recurring leakage clearly above the price, with overlaps removed: **not yet testable**, because it needs real audits. The honest-fit promise (£2,880 a year) is the test.
- One channel with a measured cost per customer: **not met**. The only acquisition spend here is the £1,000 launch budget, because audits are founder-led. Measure the cost per audit once a channel is chosen (`/founder-marketing`).
- The £336 overlap taken out of the headline: still open in the product.

---

Every number below comes from the input file. Nothing is looked up or guessed.

## One paying customer-month

| line | per paying customer-month |
| --- | ---: |
| Price | £240.00 |
| Stripe card fee (1.5% + 20p) | -£3.80 |
| Stripe Billing (0.7%) | -£1.68 |
| Infrastructure (Supabase, hosting) | -£2.50 |
| AI budget (explanations, contract PDF parsing) | -£3.00 |
| Tools (email, monitoring, PDF rendering) | -£1.00 |
| **Contribution** (what each paying customer-month leaves to pay the fixed costs) | **£228.02** (95%) |

## The margin that matters

Fixed costs: £1,060 a month (Platform (founder-only stage) £60, Lean non-people opex (software, accounting, insurance, small marketing; estimate) £1,000).

- **Break-even: 5 paying customers.** Below that you lose money every month.
- **Profit margin at your plan** (50 a month): **86%** of every sale, after every cost.
- Capacity: 25 a month.

## Year 1, month by month

| month | paying customers | revenue | profit | cumulative (after £2,402 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | £0 | -£1,060 | -£3,462 |
| 2 | 1 | £144 | -£923 | -£4,385 |
| 3 | 2 | £360 | -£718 | -£5,103 |
| 4 | 3 | £624 | -£467 | -£5,570 |
| 5 | 4 | £984 | -£125 | -£5,695 |
| 6 | 5 | £1,296 | £171 | -£5,524 |
| 7 | 7 | £1,632 | £491 | -£5,034 |
| 8 | 8 | £2,016 | £855 | -£4,178 |
| 9 | 10 | £2,376 | £1,197 | -£2,981 |
| 10 | 11 | £2,736 | £1,539 | -£1,441 |
| 11 | 13 | £3,096 | £1,881 | £440 |
| 12 | 14 | £3,432 | £2,201 | £2,641 |

- **Year 1 operating profit: £5,043** on £18,696 of revenue.
- After the £2,402 startup spend: £2,641.
- Startup money earned back: month 11.
- Cash you need before it pays for itself: **£5,695**.

## What if

| scenario | margin at plan | break-even (customers) | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 86% | 5 | £5,043 |
| Price -10% | 85% | 6 | £3,173 |
| Volume -20% | 84% | 5 | £1,490 |
| Unit costs +15% | 85% | 5 | £4,903 |

## Red flags

- The plan (50 a month) is above capacity (25).
