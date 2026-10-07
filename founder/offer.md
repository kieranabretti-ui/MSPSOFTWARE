# Offer: the Headroom Agreement Audit

7 October 2026. Built with the Offers lens (a summary of the framework in *$100M Offers*, applied here, not quoted). Inputs: `founder/board.md`, `founder/competitors.md`, `founder/panel-v1/results.md` (the first panel). `founder/numbers.json` doesn't exist yet because `/founder-cfo` hasn't run. **Every cost below is an estimate for the CFO to check.**

## Re-test result

| | Pitch v1 (self-serve subscription) | Pitch v2 (this offer) |
|---|---|---|
| Buy | **1 of 20 (5%)** | **5 of 20 (25%)** |
| Passed on effort ("convenience") | 4 | **0** |
| Passed on data quality | 1 | **0** |
| Passed on need | 7 | 6 |
| Passed on trust | 5 | **6** |
| Passed on habit or values (goodwill) | 2 | 3 |

Same 20 simulated owners (seed 7). Four changed from no to yes, none from yes to no. The guided audit removed the effort objection completely. **Trust got slightly worse**: "a one-person outfit I've never heard of, DPA or not" (P008). The line about the founder running each audit personally reads as small. Simulated buyers lean agreeable, so treat 25% as an upper bound. Results: `founder/panel/results.md`; v1 kept in `founder/panel-v1/`.

## 1. The problem list (in the buyer's words, from the panel and competitor reviews)

Before buying
1. "Exporting all that is an afternoon I don't have."
2. "I'm not uploading client data to a company I've never heard of."
3. "No reviews, no customers, nobody in my peer group uses it."
4. "My PSA already shows which agreements lose money."
5. "I already pay for Gradient / a BI tool."
6. "The demo is fictional; it says nothing about my business."
7. "My ticket categories are a mess, so the numbers will be noise."
8. "My contracts are old PDFs it will misread."
9. "My client contracts may not allow me to share their data."
10. "£249 is close to my limit." (panel price answers: bargain median £49, expensive median £150)

During
11. "The free work is goodwill on purpose; I won't chase it."
12. "Potential leakage isn't money in the bank."
13. "Every finding is an awkward conversation with a client I like."
14. "I'd spend more time checking the numbers than it saves."
15. "Another dashboard nobody opens after week three." (also in competitor reviews: setup takes weeks)

After
16. "It finds money once, then what am I paying for?"
17. "Monthly CSV uploads will get done once and dropped."
18. "What happens to my data afterwards?"
19. "My account managers won't use it, only me."
20. "Will clients leave if I start billing for more?"

## 2. Solutions, scored

Value to the buyer and cost to deliver, 1 (low) to 5 (high).

| # | Solution | Answers | Value | Cost | Keep? |
|---|---|---|---|---|---|
| A | Guided audit: 45-minute call where we do the exports together, or you send one PSA export | 1, 7, 8, 14, 15 | 5 | 3 (founder time, about 3 hours per audit, estimated) | **Core** |
| B | Report leads with what is billable without a fight (clients past their agreement, forgotten billable time, unbilled licences) | 11, 12, 13 | 5 | 1 (already built; reorder the report) | **Core** |
| C | Out-of-scope work listed separately as "goodwill or not?", for the owner to decide | 11, 20 | 4 | 1 | **Core** |
| D | Export guides for HaloPSA, ConnectWise, Autotask, Syncro | 1, 17 | 4 | 2 (one-off writing) | **Bonus** |
| E | Client conversation pack: renewal uplift emails and review-meeting scripts | 13, 19, 20 | 5 | 1 (one-off writing) | **Bonus** |
| F | Data promise: DPA signed first, UK hosting, deleted 30 days after the audit unless you subscribe | 2, 9, 18 | 5 | 2 (DPA and deletion process needed anyway) | **Bonus** (only once true) |
| G | Guarantee: you don't pay unless it finds at least £1,000 a year you accept as billable | 6, 10, 12 | 5 | 1 to 2 (see below) | **Guarantee** |
| H | Monthly check before you invoice, at £99 | 16, 17 | 4 | 1 | **Core (paid tier)** |
| I | Founding offer: first 10 MSPs, £99 locked for life, in return for an anonymised case study | 3, 6 | 4 | 1 (price lock) | **Urgency (true)** |
| J | Direct PSA integration | 1, 17 | 5 | 5 | Not now: too costly before proof |
| K | Peer benchmark ("MSPs your size give away X%") | 3, 4 | 4 | 4 (needs many audits) | Later |
| L | Cyber Essentials Plus | 2 | 3 | 3 | Consider: several panel owners asked for it |

## 3. The stack

- **Name:** the Headroom Agreement Audit.
- **Core:** "Find the money you can bill your clients without a fight." We run the first audit with you. Within 5 working days you have a list of clients past their agreement, forgotten billable time and unbilled licences, each with the ticket or clause, and a separate goodwill list for you to decide on.
- **Bonus 1, the client conversation pack** (kills "awkward conversation").
- **Bonus 2, export guides for the four main PSAs** (kills "an afternoon I don't have").
- **Bonus 3, the data promise** (kills "a company I've never heard of"). **Only offer it once the DPA, UK hosting and deletion process are real.** Today the live site isn't on its backend yet.
- **Guarantee:** the audit is free, and the monthly plan isn't charged unless the audit finds at least £1,000 a year you accept as billable.
- **Paid tier:** £99 a month for the monthly check before you invoice.
- **True urgency:** a founding offer for the first 10 MSPs (founder time is the real limit), £99 locked for life for an anonymised case study.

### What the guarantee costs (estimate)

There is no refund risk, because nobody pays before the threshold is met. The cost is the founder's time on audits that don't convert: about 3 hours each (estimated). At the panel's 25% (an upper bound), 10 audits would mean about 7 or 8 non-converting ones, so roughly 22 hours of founder time. Recommendation: raise the threshold to "at least what a year of Headroom costs you (£1,188)" so the promise always pays for itself. The CFO should model this with real audit times once the first audits are done.

## 4. Value equation (1 to 10)

| | Before (v1) | After (v2) | What moved it |
|---|---|---|---|
| Dream outcome | 6 | 7 | B: "bill without a fight" instead of "potential leakage" |
| Perceived likelihood | 3 | 5 | G guarantee, B billable-first. Still held back by no proof and the trust gap |
| Time to result | 5 | 7 | A: a 45-minute call and a report within 5 working days |
| Effort and sacrifice | 3 | 8 | A, D, E: we do the exports, plus ready-made client wording |

## 5. What to fix next

1. **Trust is now the top objection.** Don't advertise "one person". Lead with the company, the DPA and the data promise. Get the first 3 real case studies (the founding offer) and seriously consider Cyber Essentials Plus. Several owners asked for it by name.
2. **"Need" barely moved (7 to 6).** Owners whose PSA already flags unprofitable agreements, or who use Gradient, still say no. Say plainly what Headroom catches that those don't: forgotten billable time, and clients past their agreement, checked against the contract.
3. **Nobody in the relationship-first, ex-technician, peer-group or already-has-a-tool groups bought.** The offer works for numbers-driven and growing MSPs. Market to them first.
4. **Price:** the re-test puts the acceptable range at about £32 to £200, and £99 sits comfortably inside it. Keep Growth and Pro for larger MSPs and test them later.
