# CFO: Headroom

9 October 2026. Prices are the locked ones: Growth £240 a month + VAT. Revenue below is before VAT (UK VAT at 20% is added on top and passed to HMRC). The model counts Growth only, so Pro is upside. **Not financial, tax or legal advice: an accountant should check the structure, payroll and tax before money moves.**

The tool's "per day" is used here as "per month": one unit is one paying customer for one month. Inputs are in `founder/numbers.json` (founder paid) and `founder/numbers-lean.json` (founder not paid yet). Sources are in `founder/cfo-sources.md`.

## The CFO's note

**The margin.** Each paying customer leaves **£228 a month (95%)** after card fees, hosting, AI and tools. The unit economics are excellent. The question is volume, not margin.

**Two ways to read year 1:**

| | Founder paid £60k (as the pricing model assumes) | Founder not drawing a salary yet |
|---|---|---|
| Fixed costs a month | £8,560 | £1,060 |
| Break-even | **38 paying customers** | **5 paying customers** |
| Year 1 result after startup spend | **-£87,359** | **+£2,641** |
| Cash needed before it pays for itself | **£87,359** | **£5,695** |
| Startup spend earned back | not in year 1 (about month 36 at this ramp, inferred) | month 11 |

**The line to watch: the conversion from free audit to paid.** The ramp assumes 4 to 12 guided audits a month, 15% of them becoming paying customers (between the panel's 10% at £240 and 25% at £99), paying from the month after signing (the founding 30 days free), with 3% monthly churn. That gives 14 paying customers by month 12.
- At **10%** conversion (the panel at £240), the lean case loses **£872** in year 1 and doesn't earn the startup money back.
- At **25%**, the lean case makes **£16,891** and pays back in **month 8**.
- In the founder-paid case, even double the volume still loses **£67,194**.

**Cash.** If Kieran keeps another income, Headroom needs about **£5,700** before it pays for itself. Paying a £60k salary from day one needs about **£87,000**, or funding.

**Capacity.** One founder can run roughly 25 customers plus the audits (the pricing model's founder-only stage). Break-even with a full salary (38) is above that, so a salaried founder also needs a hire before break-even.

**Three ways to improve it** (what-ifs run with the tool):
1. **Raise conversion from 15% to 25%.** Lean year 1 goes from +£5,043 to **+£16,891**, with payback in month 8 instead of 11. This is the guided audit, the honest-fit promise and the client conversation pack doing their job, so measure it from the first 10 audits.
2. **Sell Pro to 1 in 10.** At a blended £279 a month: break-even with salary drops from 38 to **32**, and the lean year 1 rises to **+£8,081**.
3. **Delay the founder salary until about 38 customers, or fund it.** This alone is the difference between -£85k and +£5k in year 1.

Not worth chasing: unit costs. Costs up 15% moves the founder-paid year 1 by only £140.

**The board's money conditions** (`founder/board.md`):
- Recurring leakage clearly above the price, with overlaps removed: **not yet testable**, because it needs real audits. The honest-fit promise (£2,880 a year) is the right test.
- One channel with a measured cost per customer: **not met**. This model has no paid acquisition beyond a £1,000 launch budget, because audits are founder-led. Measure the cost per audit once a channel is chosen (`/founder-marketing`).
- The £336 overlap taken out of the headline: still open in the product.

---

# Unit economics: Headroom (Growth plan, founder-led year 1)

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

Fixed costs: £8,560 a month (Founder salary £60k x 1.2 on-costs £6,000, Platform (founder-only stage) £60, Non-people opex (marketing, software, legal, accounting, insurance) £2,500).

- **Break-even: 38 paying customers.** Below that you lose money every month.
- **Profit margin at your plan** (50 a month): **24%** of every sale, after every cost.
- Capacity: 25 a month.

## Year 1, month by month

| month | paying customers | revenue | profit | cumulative (after £2,402 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | £0 | -£8,560 | -£10,962 |
| 2 | 1 | £144 | -£8,423 | -£19,385 |
| 3 | 2 | £360 | -£8,218 | -£27,603 |
| 4 | 3 | £624 | -£7,967 | -£35,570 |
| 5 | 4 | £984 | -£7,625 | -£43,195 |
| 6 | 5 | £1,296 | -£7,329 | -£50,524 |
| 7 | 7 | £1,632 | -£7,009 | -£57,534 |
| 8 | 8 | £2,016 | -£6,645 | -£64,178 |
| 9 | 10 | £2,376 | -£6,303 | -£70,481 |
| 10 | 11 | £2,736 | -£5,961 | -£76,441 |
| 11 | 13 | £3,096 | -£5,619 | -£82,060 |
| 12 | 14 | £3,432 | -£5,299 | -£87,359 |

- **Year 1 operating profit: -£84,957** on £18,696 of revenue.
- After the £2,402 startup spend: -£87,359.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **£87,359**.

## What if

| scenario | margin at plan | break-even (customers) | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 24% | 38 | -£84,957 |
| Price -10% | 15% | 42 | -£86,827 |
| Volume -20% | 6% | 38 | -£88,510 |
| Unit costs +15% | 23% | 38 | -£85,097 |

## Red flags

- Break-even needs 38 paying customers but capacity is 25.
- The plan (50 a month) is above capacity (25).
- Year 1 loses money on operations (-£84,957).
- The startup spend is not earned back within year 1.

---

## Lean case (founder not drawing a salary)

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
