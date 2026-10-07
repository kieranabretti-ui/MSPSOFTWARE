# Product

<!-- impeccable:product-schema 1 -->

Recorded 6 October 2026 from Kieran's MVP specification and brand brief (both in the project thread); no separate interview was run, so every fact below comes from those briefs or the codebase.

## Platform

web

## Users

Owners and commercial leads of Managed Service Providers (MSPs): IT support businesses, typically 5 to 50 people, that run their clients' IT on monthly agreements. They are commercially sharp, often ex-technicians, short on time, and sceptical of vendors. They use the product at a desk, usually monthly or before a client review, to answer "where is my MSP losing money, and what do I do about it?"

## Product Purpose

Headroom reads the exports an MSP already has (tickets, time entries, users and devices, billing lines, contracts and SOWs) and finds revenue leakage: out-of-scope work done for free, billable time never invoiced, clients who have grown past their agreement, unbilled licences and recurring charges, underpriced clients, and support use beyond allowances. Every opportunity shows its evidence, how its value was calculated, a confidence level (High, Medium, Low) with its basis, an estimated value and a recommended action. Success is an owner who recovers money, reprices a client or tightens an agreement because of what they saw.

## Positioning

A financial and commercial intelligence product for MSPs, not an IT tool: it talks about money, margins and revenue rather than technical jargon. Its mechanism is a deterministic rules engine that ties every pound back to the ticket, time entry, device or contract clause behind it. The company is expected to grow from leakage detection into profitability, contract optimisation, scope management, pricing, billing reconciliation, forecasting and automated change orders.

## Operating Context

Data arrives as CSV exports from a PSA, RMM and billing system, plus contract PDFs. There are no integrations yet; they are planned. A one-click demo (Northlight IT, a fictional MSP with 15 clients) shows a full analysis. Reports are downloaded as PDF or CSV and taken into client reviews.

## Capabilities and Constraints

- Local mode (browser storage) when Supabase keys are absent; Supabase Auth, Postgres with Row Level Security, and private storage when present. An optional AI explanation covers one opportunity at a time, only when asked.
- Figures are always presented as potential leakage to review, never as money definitely recoverable.
- Demo headline figures are pinned by tests: £4,281 identified, £356 a month recurring, £4,272 annualised.
- Pricing (Starter £99, Growth £249, Pro £499 a month) is planned, not live; the tier limits shown on the landing page are proposals. The free audit is a self-serve account plus its first analysis.

## Brand Commitments

- Name: Headroom (renamed from the working name MSP Leak on 6 October 2026 after a scored naming exercise; see brand/naming.md). Tagline: "Find the work your MSP is doing for free."
- Feel: a serious, premium financial and operations SaaS. Intelligent, financially focused, precise, trustworthy, modern, professional, confident, slightly bold, operational, premium. Not childish, gimmicky, hacker-themed, overly futuristic, an AI chatbot, accounting software or generic MSP software.
- Personality: confident, intelligent, commercial, direct, calm, trustworthy.
- Pinned visual direction from the brief: a strong dark foundation (near-black, charcoal) with one distinctive energetic accent (electric lime) that means money recovered, used carefully. Danger communicates an issue without dominating. Quality references, not to be copied: Stripe, Linear, Ramp, Vercel, Mercury, Brex.
- Voice: short, specific, confident, commercial ("£4,281 potential leakage", "Recover £356 MRR").

## Evidence on Hand

- The working app and its demo dataset (src/demo). All landing-page product imagery must come from the real app and real demo figures, labelled as demo data.
- No customers, testimonials, logos, benchmarks or integrations exist yet. None may be invented.

## Product Principles

1. Every pound is traceable to evidence.
2. Money first, mechanics second.
3. Potential, never promised.
4. Calm about problems, confident about fixes.
5. Works with what the MSP already exports.
