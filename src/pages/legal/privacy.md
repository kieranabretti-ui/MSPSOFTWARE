This policy explains what personal data Headroom collects, why, what we do with it, who else handles it, and the rights you have. It is written for the managed service providers (MSPs) who use Headroom and for anyone whose details appear in the data those MSPs upload.

## 1. Who we are {#who}

Headroom is a trading name of **A-IT & Cyber Group Ltd**, a company registered in England and Wales (company number 17473234). Our registered office is 26 Balston Road, Poole, BH14 0QH.

In this policy, "Headroom", "we" and "us" mean A-IT & Cyber Group Ltd. "You" means the person using Headroom, usually on behalf of an MSP.

To contact us about anything in this policy, use the details in section 15.

## 2. Two different roles {#roles}

Headroom handles personal data in two different capacities, and the difference matters.

**We are the controller** for the data about you as our customer: your account, how you use the website, and our correspondence with you. We decide why and how that data is used.

**We are a processor** for the data you upload about your own business and your clients: PSA exports (clients, tickets, time entries, users and devices, billing lines) and contract documents. Your MSP is the controller of that data. We process it only to provide Headroom to you and on your instructions. Section 5 and the Data Processing Annex at the end of this policy cover this.

## 3. What we collect as controller, and why {#collect}

| What | Where it comes from | Why we use it | Lawful basis (UK GDPR Art. 6) |
|---|---|---|---|
| **Account details**: your name, email address and a password (stored by our authentication provider as a one-way hash, never readable by us) | You, when you sign up | To create and secure your account, sign you in (by password or a one-time email link), and contact you about your account | Contract (Art. 6(1)(b)) |
| **Plan interest**: the paid plan you selected when signing up, if any | You, when you sign up from a pricing link | To follow up about the plan you showed interest in | Legitimate interests (Art. 6(1)(f)): understanding demand and replying to your interest |
| **Workspace details**: your workspace name and settings | You | To run the service | Contract (Art. 6(1)(b)) |
| **Activity log**: the actions taken in your workspace (for example an upload, an analysis run, a decision on an opportunity, an export or a deletion), with the user ID and email address of the person who took them, the time, and record IDs and counts | Automatically, when you use the app | So your workspace has a record of who did what, which you can check | Contract (Art. 6(1)(b)) |
| **Technical and security logs**: IP address, browser details, request times and authentication events, recorded by our hosting and authentication providers | Automatically, when you use the site | To keep the service running and secure, and to investigate faults or abuse | Legitimate interests (Art. 6(1)(f)): security and reliability |
| **Product usage events** (only if switched on; see section 7) | Automatically, when you use the app | To understand which parts of the product are used, so we can improve it | Legitimate interests (Art. 6(1)(f)): improving the product |
| **Correspondence**: messages you send us and our replies | You | To answer you and keep a record of what was agreed | Legitimate interests (Art. 6(1)(f)); contract where it concerns your subscription |
| **Billing details**, once paid plans are live: business name, billing address, VAT number, and payment records | You and our payment provider | To bill you and meet tax and accounting obligations | Contract (Art. 6(1)(b)); legal obligation (Art. 6(1)(c)) |

Headroom does not have online checkout yet. When it does, card details will be collected and held by a payment provider, not by us, and we will name that provider in section 8 before checkout starts.

You don't have to give us any personal data, but we need your name and email address to create your account; without them you can only use the demo. Billing details will be needed to buy a paid plan.

We don't make decisions about you based solely on automated processing that have legal or similarly significant effects. Headroom's rules engine analyses your uploaded business data to suggest opportunities for you to review; it doesn't make decisions about individuals.

We do not sell personal data, use it for advertising, or build marketing profiles. We don't currently send marketing emails, and we will update this policy before we do.

## 4. What we don't collect {#not-collected}

- We don't connect to your PSA, RMM or accounting system. Headroom works only from files you choose to export and upload.
- We don't ask for admin accounts, API credentials or agents on your systems.
- When you import a CSV, it is read in your browser and only the columns you map are saved. The original CSV file is not uploaded.
- When you add a contract PDF, its text is extracted in your browser. On the hosted service, the text and the PDF file itself are then stored (see section 5). In evaluation mode only the extracted text is kept, in your browser.
- We don't use advertising or third-party tracking cookies.

## 5. Data you upload about your clients (we act as processor) {#uploads}

To find possible commercial opportunities, you upload exports from your own systems. Depending on what you upload, this can include personal data such as:

- names of your technicians, in tickets and time entries;
- names of your clients' staff and users, in user and device lists, and licence assignments;
- ticket subjects and descriptions, which can mention people and their requests;
- the text of contracts and statements of work, which can include names and contact details of signatories; and the contract PDF files themselves.

Your MSP is the controller of this data and is responsible for having a lawful basis to share it with us and for telling the people concerned, where required. We process it only to provide Headroom to you, as set out in the Data Processing Annex. We don't use it to train AI models, and we don't use it for our own purposes.

Please don't upload special category data (for example health information) or criminal offence data. Headroom doesn't need it. If ticket text you export contains it, consider removing it before upload.

If you are a person whose details appear in an MSP's data and you want to exercise your rights, please contact that MSP first. If you contact us, we will pass your request to them and help them respond.

## 6. AI explanations (optional) {#ai}

Headroom's analysis is a rules engine. No AI model decides what counts as an opportunity or what it is worth, and no figure is produced by AI.

There is one optional AI feature. When you click **Explain** on a single opportunity, we send that one opportunity to Anthropic's Claude API so it can write a plain-English explanation. The request contains:

- the client's name;
- the opportunity's category, title, description, estimated value and recommended action; and
- its evidence, which can include ticket text, time entries with technician names, and quoted contract sentences.

The request is made from our server (a Supabase Edge Function), using your own sign-in, so the same access rules apply. That function may run in a Supabase data centre outside the UK. The explanation is saved with the opportunity, labelled as AI-assisted, and is deleted with it. It is also cleared when the evidence behind the opportunity changes. Nothing is sent to Anthropic unless you click the button, and explanations are not available in the demo or in evaluation mode.

Anthropic, PBC is based in the United States. It processes this data as our subprocessor under its [commercial terms](https://www.anthropic.com/legal/commercial-terms). See section 9 on international transfers.

## 7. Cookies and browser storage {#storage}

Headroom does not set advertising or analytics cookies. It uses your browser's local storage for the following, all needed for the service you asked for, or set only when you choose a feature:

| Key | What it holds | Why | When |
|---|---|---|---|
| `sb-<project>-auth-token` | Your sign-in session token | Keeps you signed in | Hosted service, after you sign in. Removed when you sign out |
| `headroom:mode` | The value `demo` | Remembers that you are in the demo, so the demo opens instead of your account | Only if you start the demo |
| `headroom:users`, `headroom:session`, `headroom:workspaces`, `headroom:data:<id>` | In evaluation or demo mode only: local accounts (name, email, a salted password hash), the current session, workspaces, and all workspace data | Evaluation and demo mode store everything in this browser instead of on a server | Only in evaluation or demo mode |

In **evaluation mode** (when Headroom runs without its server) and in the **demo**, all data stays in the browser on your device and is not sent to us (apart from the product usage events described below, if they are switched on, which are marked as coming from the demo or evaluation mode). Evaluation mode is for trying the product, not for real client data. You can remove this data with "Sign out and remove data from this browser", or by clearing the site's data in your browser.

We use these only because the service you asked for needs them, so we don't show a cookie banner.

**Product usage events.** If product analytics are switched on, Headroom sends usage events to our analytics endpoint: which page was open, which button was clicked, and counts such as how many rows were imported or how many opportunities an analysis found. Events carry no account ID, and never carry names, email addresses, file contents, opportunity titles or £ values. The page address can include an internal record number (for example of an opportunity or client), but not a name. They use no cookies and store nothing in your browser. Analytics are switched off unless we configure an endpoint, and we will name the service that receives the events in section 8 before we switch them on. The request itself reveals your IP address to that service.

Fonts are served from our own site, not from a third-party font service.

## 8. Who else handles your data (subprocessors) {#subprocessors}

We use these providers to run Headroom.

| Provider | What they do | Data involved | Location |
|---|---|---|---|
| **Supabase, Inc.** | Authentication, database, file storage and the server function that calls the AI | Account data; all workspace data you upload, including contract files; logs | Database and file storage hosted in the UK (London region). The AI server function may run in a Supabase data centre outside the UK (see section 6). Supabase, Inc. is a US company, and its staff may access data from outside the UK to support the service |
| **Netlify, Inc.** | Hosts and delivers the website through its content delivery network | Request logs, including IP address and browser details. No workspace data is stored with Netlify | Global edge network; Netlify, Inc. is a US company |
| **Anthropic, PBC** | AI explanations, only when you click Explain | One opportunity and its evidence (see section 6) | United States |
| **Email delivery provider** | Sends sign-up confirmation and one-time sign-in emails | Your name and email address | To be confirmed; we will name the provider here |

We will update this list before adding or replacing a subprocessor that handles your uploaded data (see the Data Processing Annex, paragraph 6). The [Trust Centre](/trust#processing) shows the same list.

We may also disclose personal data if the law requires it, to protect our legal rights, or to a buyer if the business is sold (in which case this policy continues to apply to your data).

## 9. International transfers {#transfers}

Your workspace data is stored in the United Kingdom. Some processing takes place outside the UK:

- **Anthropic (United States)**, when you use AI explanations;
- **Supabase**, where the AI server function runs in a data centre outside the UK (see section 6);
- **Netlify** request handling at edge locations, which may be outside the UK; and
- support or operational access by US-based providers.

Where personal data is transferred outside the UK to a country without UK adequacy regulations, we rely on the transfer safeguards in each provider's data processing terms. You can ask us which safeguard applies to each provider (see section 15).

## 10. How long we keep data {#retention}

- **Workspace data you upload** (clients, tickets, time entries, users and devices, billing lines, contracts and contract files, upload records (file names and column mappings), analyses, opportunities, decisions and notes, AI explanations, tasks and reports) stays until you delete it. There is no automatic deletion schedule yet. You can delete a single source file, a single analysis, all workspace data, the workspace or your account; the [Trust Centre](/trust#deletion) sets out exactly what each one deletes.
- **The activity log** stays until the workspace is deleted. Clearing workspace data doesn't remove it, so the log keeps a record that the deletion happened (counts only, no client data).
- **Your account** (name and email) stays until you delete it. You can delete your account in Settings. That deletes your workspace and everything in it, including stored contract files.
- **Logs** held by Supabase and Netlify are kept for the periods those providers set.
- **Billing records**, once paid plans exist, are kept for as long as UK tax and company law requires.
- **Correspondence** is kept for as long as needed to deal with the matter.
- **Backups**: data you delete may remain in any backups our database provider keeps until they expire. We will state the backup schedule in the Trust Centre once it is confirmed. Backups are not used to restore deleted data except to recover from a fault.

## 11. Your rights {#rights}

Under UK data protection law you have the right to:

- **access** the personal data we hold about you;
- **correct** data that is wrong or incomplete;
- **delete** your data in certain circumstances;
- **restrict** how we use it in certain circumstances;
- **object** to processing we carry out on the basis of legitimate interests;
- **data portability**: receive data you gave us in a commonly used format. You can export opportunities and reports as CSV, and reports as PDF, at any time; and
- **withdraw consent**, where we rely on consent (we don't currently rely on consent for anything).

Contact us (section 15) to use any of these rights. We will reply within one month, and may ask you to confirm your identity first. There is no charge in most cases.

For data an MSP uploaded about you, see section 5: the MSP is the controller and the right place to start.

**Complaints.** If you are unhappy with how we have handled your data, please tell us first so we can try to put it right. You also have the right to complain to the Information Commissioner's Office (ICO), the UK data protection regulator: ico.org.uk/make-a-complaint, or 0303 123 1113.

## 12. How we protect data {#security}

What is in place today on the hosted service:

- The site is served over HTTPS only, tells browsers never to fall back to plain HTTP (HSTS), and enforces a Content Security Policy.
- Data is stored in Postgres with row-level security on every table. Every table that holds workspace data carries a workspace ID, and the database returns those rows only to signed-in members of that workspace. Links between records are keyed on the workspace, so a record can't point into another workspace. Your profile row is readable only by you.
- Workspaces can only be created through a database function that makes the creator the owner. Nobody can add themselves to another workspace.
- Contract files are kept in a private storage bucket, in a folder for each workspace that only its members can read, limited to PDF and plain text files up to 20 MB.
- Key actions are recorded in an append-only activity log that members can't edit or delete.
- The AI service key is held on the server and never sent to the browser. AI explanations are written by the server, checked against your evidence, and limited per workspace each day and per user each hour and each day.
- Passwords are handled by Supabase Auth and are not visible to us. The sign-up form requires at least 10 characters, with upper and lower case letters and a number.
- Supabase, our database provider, encrypts stored data at rest. This is the provider's control.
- CSV files are read in the browser and only mapped columns are saved.

What isn't in place yet, so you can judge for yourself: Headroom isn't SOC 2 or ISO 27001 certified and hasn't had an independent penetration test. There is no single sign-on or multi-factor authentication in the app yet, and each workspace has one user. The [Trust Centre](/trust#roadmap) keeps this list current.

If we become aware of a personal data breach that affects you, we will tell you without undue delay, and we will report it to the ICO where the law requires.

## 13. Children {#children}

Headroom is a business service for MSPs. It is not intended for anyone under 18 and we don't knowingly collect children's data as controller.

## 14. Changes to this policy {#changes}

We will update this policy when what we do with data changes. We will show the new date at the top, and tell you by email or in the app before any material change takes effect.

## 15. Contact {#contact}

A-IT & Cyber Group Ltd (trading as Headroom), 26 Balston Road, Poole, BH14 0QH.

{{CONTACT_LINE}}

---

# Data Processing Annex {#dpa}

This annex sets out the terms on which we process personal data on behalf of our customers, as required by Article 28 of the UK GDPR. It forms part of the Headroom [Terms of Service](/terms). In it, "Customer" means the MSP (the controller) and "Headroom" means A-IT & Cyber Group Ltd (the processor).

## 1. Subject matter and duration {#dpa-1}

**Subject matter:** providing the Headroom service: importing the Customer's PSA, RMM, billing and contract data, analysing it for possible commercial opportunities, showing the results, producing reports and, on request, AI explanations of individual opportunities.

**Duration:** for as long as the Customer uses Headroom, and then until the data is deleted under paragraph 9.

## 2. Nature and purpose of processing {#dpa-2}

Storage, organisation, analysis, retrieval, display, export and deletion of Customer data, solely to provide Headroom to the Customer. CSV files are parsed and contract PDF text is extracted in the Customer's browser before storage. Analysis runs in the Customer's browser using a deterministic rules engine; results are stored in the database. AI processing occurs only when the Customer requests an explanation of a specific opportunity (see paragraph 6).

## 3. Categories of data subjects {#dpa-3}

- The Customer's staff, in particular technicians named in tickets and time entries.
- The Customer's clients' staff and end users, named in user and device lists, ticket text and contracts.
- Signatories and contacts named in the Customer's contracts and statements of work.

## 4. Categories of personal data {#dpa-4}

- Names (technicians, client staff and users).
- Ticket subjects and descriptions, which may contain any information the Customer's systems recorded, including contact details.
- Time entry records (date, technician, duration, billable flag).
- User and device records (name, type, licence, ownership, status, first seen date).
- Contract text and the original contract PDF files.
- Commercial data about the Customer's clients (client names, monthly revenue, package, contract dates and terms), which is not usually personal data but may be where a client is a sole trader.

**Special category data:** not required by the service. The Customer will not intentionally upload it and should remove it from exports where practical.

## 5. Headroom's obligations {#dpa-5}

Headroom will:

1. process Customer personal data only on the Customer's documented instructions (including as to transfers outside the UK, which the Customer authorises to the extent described in paragraph 6), which are the Terms of Service, this annex, and the Customer's use of the product's features, unless UK law requires otherwise (in which case Headroom will tell the Customer first, unless the law forbids it);
2. make sure anyone it authorises to process the data is bound by confidentiality;
3. apply the security measures in paragraph 7;
4. help the Customer, taking into account the nature of the processing, to respond to data subject requests. In the product, the Customer can export opportunities and reports, and delete a source file, an analysis, all workspace data, the workspace or the account. Where the Customer needs a specific individual's records found, corrected or deleted, Headroom will do this on request;
5. help the Customer with its obligations on security, breach notification, data protection impact assessments and prior consultation with the ICO, as far as the information available to Headroom allows;
6. delete or return Customer personal data at the end of the service, as set out in paragraph 9;
7. make available the information needed to show compliance with Article 28 and allow audits as set out in paragraph 10; and
8. tell the Customer straight away if it thinks an instruction breaks UK data protection law.

## 6. Subprocessors {#dpa-6}

The Customer gives general authorisation for Headroom to use the following subprocessors:

| Subprocessor | Purpose | Location of processing |
|---|---|---|
| Supabase, Inc. | Authentication, database, file storage, server functions | UK (London region) for stored data; the AI server function may run outside the UK; US-based company whose staff may access data from outside the UK to support the service |
| Netlify, Inc. | Website hosting and content delivery (request logs only; no workspace data stored) | Global edge network; US-based company |
| Anthropic, PBC | AI explanation of a single opportunity, only when the Customer requests it | United States |

Headroom will tell the Customer by email before adding or replacing a subprocessor that processes Customer personal data. If the Customer objects on reasonable data protection grounds, the parties will discuss it in good faith; if it cannot be resolved, the Customer may terminate the affected service and receive a pro rata refund of prepaid fees for the unused period.

Headroom will engage each subprocessor under a written contract that imposes data protection obligations no less protective than those in this annex, to the extent they apply to the service the subprocessor provides. Headroom remains responsible to the Customer for its subprocessors' performance of their data protection obligations.

Account emails (sign-up confirmation and sign-in links) are sent for Headroom as controller and are covered by the privacy policy, not this annex.

Transfers outside the UK are covered by the safeguards described in section 9 of the privacy policy.

## 7. Security measures {#dpa-7}

These are the measures that exist today on the hosted service:

- Transport encryption: HTTPS only, with HSTS and an enforced Content Security Policy.
- Workspace isolation: Postgres row-level security on every table, scoped by workspace ID and checked against workspace membership for every request; records reference each other by workspace as well as ID.
- Workspace creation only through a server-side function that assigns ownership; users cannot join workspaces they don't own.
- Private file storage, with access policies limiting each workspace's folder to its members, and file type and size limits.
- An append-only activity log of key actions, holding IDs, counts and stage names rather than client data.
- Authentication by Supabase Auth (email and password, or a one-time email link), with the password rule applied on the sign-in service: at least 10 characters with upper and lower case letters and a number. Passwords are stored by Supabase as one-way hashes.
- AI provider key held as a server secret, never exposed to the browser. AI requests run under the user's own session, so row-level security still applies; explanations are written by the server and rate limited.
- Data minimisation: CSV files are parsed in the browser and only mapped columns are stored; original CSV files are not uploaded. Only the single opportunity selected is sent for AI explanation, and nothing is sent unless the user asks.
- Product analytics, where enabled, carry no personal data or file contents.
- Encryption at rest is provided by Supabase as a provider control. Database backups are whatever the provider's plan includes; their schedule is not yet stated.

Not in place: SOC 2 or ISO 27001 certification, independent penetration testing, in-app multi-factor authentication, single sign-on.

## 8. Personal data breaches {#dpa-8}

Headroom will notify the Customer without undue delay after becoming aware of a personal data breach affecting Customer personal data. The notice will include, as far as then known: what happened, the categories and approximate number of data subjects and records concerned, likely consequences, and the measures taken or proposed. Headroom will provide further information as it becomes available and will cooperate with the Customer's investigation. The Customer, as controller, decides whether to notify the ICO and data subjects.

## 9. Deletion and return {#dpa-9}

- **During the service:** the Customer can export opportunities and reports as CSV or PDF at any time, and can delete a source file, an analysis, all workspace data (including stored contract files), the workspace or the account.
- **At the end of the service, at the Customer's choice:** Headroom will either delete the Customer personal data or return it and then delete it. The Customer keeps its own original exports and contract files. If the Customer asks in writing within 30 days of the service ending, Headroom will return the workspace's stored records (clients, tickets, time entries, users and devices, billing lines, contract text, opportunities and decisions) as CSV files, with any stored contract files, and then delete them. Deleting the account deletes the workspace and the Customer personal data in it, including stored contract files; a Customer that wants a copy should ask for it, or export what it needs, first. If the service ends in another way and no return is requested, Headroom will delete the workspace and remaining Customer personal data without undue delay, unless UK law requires it to be kept.
- **Backups:** deleted data may remain in the database provider's backups until they expire in the normal cycle, and will not be restored except to recover from a fault.
- On request, Headroom will confirm deletion in writing.

## 10. Audits and information {#dpa-10}

Headroom will make available on request the information reasonably needed to demonstrate compliance with this annex, including a written description of its security measures and its subprocessor list. Headroom does not hold third-party certifications. The Customer may carry out (or appoint an independent auditor to carry out) an audit, on reasonable written notice, no more than once a year unless required by a regulator or following a breach, during business hours, at the Customer's cost, and subject to confidentiality. Audits of subprocessors are carried out by relying on the subprocessor's own reports and certifications.

## 11. Liability {#dpa-11}

Each party's liability under this annex is subject to the limits in the Terms of Service, except where UK law does not allow liability to be limited.
