import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, cx } from '../../components/ui'
import { COMPANY, HOSTED, TRUST_COPY } from '../../brand/brand'
import { CLASSIFICATION_DEFINITIONS, CONFIDENCE_DEFINITIONS } from '../../engine/confidence'
import { CLASSIFICATION, CLASSIFICATION_ORDER, CONFIDENCE, LEVEL_ORDER } from '../../lib/labels'
import { PageSection, PublicPage, linkCls } from './PublicPage'

// The Trust Centre: what Headroom does with an MSP's data, in sentences the
// code and its deploy config back. Claims about server-side controls are made
// only on the hosted service (HOSTED: Supabase keys present); evaluation mode
// says plainly that data stays in the browser. Anything not built is listed
// under "Not in place yet". Sources: supabase/migrations (RLS, composite
// tenant keys, audit_log, delete RPCs, storage limits), supabase/tests/rls.sql,
// supabase/functions/ai-review, public/_headers, src/engine (rules,
// confidence), src/data/localBackend.ts (local caps), docs/methodology.md.

type Fact = { text: ReactNode; tag?: 'provider' | 'hosted' | 'evaluation' }

const TAGS = { provider: 'Provider control', hosted: 'Hosted service', evaluation: 'Evaluation mode' } as const

function Facts({ items }: { items: Fact[] }) {
  return (
    <ul className="divide-y divide-line-soft border-y border-line-soft">
      {items.map((f, i) => (
        <li key={i} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <span className="max-w-[62ch] text-body text-ink-2">{f.text}</span>
          {f.tag && (
            <span className="shrink-0">
              <Badge tone={f.tag === 'evaluation' ? 'warning' : 'neutral'}>{TAGS[f.tag]}</Badge>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 mt-9 text-h3 text-ink first:mt-0">{children}</h3>
}

function Table({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2.5 pr-4 text-left text-label uppercase text-ink-3 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cx('py-3 pr-4 align-top last:pr-0', j === 0 ? 'font-medium text-ink' : 'text-ink-2')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const ext = (href: string, label: string) => (
  <a href={href} className={linkCls} rel="noreferrer">
    {label}
  </a>
)

const SECTIONS = [
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'processing', label: 'Data processing' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'ai', label: 'AI' },
  { id: 'evidence', label: 'Evidence and confidence' },
  { id: 'deletion', label: 'Data deletion' },
  { id: 'contact', label: 'Security contact' },
  { id: 'roadmap', label: 'Not in place yet' },
]

// Per-rule confidence criteria, as docs/methodology.md section 4 and src/engine/confidence.ts set them.
const RULE_CONFIDENCE: [string, string, string][] = [
  ['Out-of-scope work', 'Agreement clause matched with no other wording saying the work is included, strong wording match, hourly rate from the agreement and, for out-of-hours work, support hours from the agreement', 'Medium'],
  ['Billable ticket, non-billable time', 'Never: the time may be a deliberate write-off', 'Medium'],
  ['Chargeable-looking work', 'Never: nothing confirms it is chargeable', 'Low'],
  ['Recurring charge below agreement', 'Contracted quantity stated in an agreement, and one unambiguous per-unit billing line', 'Medium'],
  ['Missing recurring charge', 'Never: it may be bundled into another line', 'Low'],
  ['Agreement drift', 'Contracted quantity from an agreement the clients file does not contradict, fewer billed than active, priced at one unambiguous billing line, every asset dated', 'Medium'],
  ['Unbilled licences', 'Licence and billing line names identical', 'Medium'],
  ['Usage over allowance', 'Never: invoices are not in the data, so the overage may already be billed', 'Medium or Low'],
  ['Underpriced client', 'Never: the margin is a modelled estimate', 'Low'],
]

export default function TrustCentre() {
  const contact = COMPANY.securityEmail ?? COMPANY.contactEmail
  const office = [COMPANY.legalName, COMPANY.registeredAddress].filter(Boolean).join(', ')

  const security: Fact[] = HOSTED
    ? [
        { text: 'Sign-in uses Supabase Auth: email and password, or a one-time email link. The sign-up form requires a password of at least 10 characters, with upper and lower case letters and a number.', tag: 'hosted' },
        { text: 'Postgres row-level security is on for every table. Every row carries its workspace ID, and the database returns rows only to signed-in members of that workspace.', tag: 'hosted' },
        { text: "Links between records are keyed on the workspace as well as the record, so a row in one workspace can't point at a record in another. Signed-out visitors have no access to any table.", tag: 'hosted' },
        { text: 'The isolation checks ship with the code (supabase/tests/rls.sql): reads, writes, deletes and cross-workspace references from a second account are all refused.', tag: 'hosted' },
        { text: 'Contract files sit in a private storage bucket, in a folder only your workspace can read. It accepts PDF and plain text files up to 20 MB.', tag: 'hosted' },
        { text: 'Key actions are written to an append-only audit log: uploads, analysis runs, opportunity decisions, exports and deletions. Members can add entries but cannot edit or delete them. Entries hold IDs, counts and stage names, not client data.', tag: 'hosted' },
        { text: 'The site is served over HTTPS only with HSTS, under an enforced Content Security Policy, and refuses to be framed by other sites.' },
        { text: 'CSV exports neutralise cells that a spreadsheet would run as a formula.' },
      ]
    : [
        { text: 'This deployment runs in evaluation mode. Accounts and workspace data are stored in this browser, with no server-side login. Anyone with access to this browser profile can read them.', tag: 'evaluation' },
        { text: 'Use evaluation mode and the demo to try the product, with sample data. Do not upload client data to it.', tag: 'evaluation' },
        { text: 'On the hosted service, workspaces are isolated by Postgres row-level security and workspace-keyed records, contract files sit in private storage, and key actions go to an append-only audit log.' },
        { text: 'The site is served over HTTPS only with HSTS, under an enforced Content Security Policy, and refuses to be framed by other sites.' },
        { text: 'CSV exports neutralise cells that a spreadsheet would run as a formula.' },
      ]

  return (
    <PublicPage
      docTitle="Trust Centre"
      title="How Headroom handles your data"
      lead={
        <p>
          Headroom is early-stage software. This page states only the controls that exist today, marks the ones our providers run, and lists what isn't in place yet. {TRUST_COPY.decides}
        </p>
      }
      meta={
        HOSTED ? (
          <p>This is the hosted service. Workspace data is stored by Supabase in its London region, in the United Kingdom.</p>
        ) : (
          <p className="rounded-md border border-warning-line bg-warning-soft px-3.5 py-3 text-ink-2">
            This deployment runs in evaluation mode: data stays in this browser and isn't protected by a server login. Use the demo or sample data, not client data.
          </p>
        )
      }
      index={SECTIONS}
    >
      <PageSection id="security" title="Security" intro="Access controls, isolation between workspaces, and the audit log.">
        <Facts items={security} />
        <Sub>Who can access your data</Sub>
        <Facts
          items={[
            ...(HOSTED
              ? ([
                  { text: 'Inside Headroom: only signed-in members of your workspace. Each workspace has one user today.', tag: 'hosted' },
                  {
                    text: "Headroom's operators can technically reach stored data through the hosting provider's administration tools. That access is used only to run, secure and support the service, as the Terms set out.",
                    tag: 'hosted',
                  },
                  { text: 'Nobody can add themselves to another workspace: workspaces are created only through a database function that makes the creator its owner.', tag: 'hosted' },
                ] satisfies Fact[])
              : ([
                  { text: 'Anyone with access to this browser profile can read the data stored in it. Nothing is sent to a Headroom server, so Headroom staff cannot see it.', tag: 'evaluation' },
                ] satisfies Fact[])),
          ]}
        />
        <Sub>If something goes wrong</Sub>
        <Facts items={[{ text: 'If we become aware of a personal data breach that affects you, we will tell you without undue delay, and report it to the ICO where the law requires.' }]} />
      </PageSection>

      <PageSection id="privacy" title="Privacy" intro={<>What is stored, why, and for how long. The full account is in the <Link to="/privacy" className={linkCls}>privacy policy</Link>.</>}>
        <Table
          caption="What Headroom stores"
          head={['What', 'Why', 'Kept']}
          rows={[
            ['Your name and email', 'To create your account and sign you in', 'Until you delete your account'],
            ['The columns you map from each CSV', 'To run the analysis. The original CSV file is never uploaded.', 'Until you delete the file, clear your data or delete the workspace'],
            [HOSTED ? 'Contract text and the PDF file' : 'Contract text', 'To check work against what each agreement covers', 'Until you delete the file, clear your data or delete the workspace'],
            ['Analyses, opportunities, decisions, notes and reports', 'To show results and record what you decided', 'Until you delete the analysis, clear your data or delete the workspace'],
            ['Audit log entries (IDs, counts and stage names only)', 'A record of who did what, for you to check', 'Until you delete the workspace'],
          ]}
        />
        <Facts
          items={[
            { text: 'There is no automatic retention schedule yet: data stays until you delete it.' },
            HOSTED
              ? { text: 'The hosted service keeps every analysis. The app shows the newest 1,000 audit log entries.', tag: 'hosted' }
              : { text: 'This browser keeps the 12 most recent analyses and the 2,000 most recent audit log entries.', tag: 'evaluation' },
            { text: 'Headroom sets no advertising or analytics cookies. Product analytics, where switched on, carry no names, email addresses, file contents, opportunity titles or £ values.' },
            { text: 'We do not sell data, use it for advertising, or use it to train AI models.' },
          ]}
        />
      </PageSection>

      <PageSection
        id="processing"
        title="Data processing"
        intro={
          <>
            For the data you upload, your MSP is the controller and Headroom is the processor. The{' '}
            <Link to="/privacy#dpa" className={linkCls}>
              data processing annex
            </Link>{' '}
            sets out the terms.
          </>
        }
      >
        <Sub>Subprocessors</Sub>
        <Table
          caption="Subprocessors"
          head={['Provider', 'What it does', 'Data involved', 'Where']}
          rows={[
            ['Supabase, Inc.', 'Sign-in, database, file storage and the server function that requests AI explanations', 'Account data and all workspace data, including contract files', 'Stored in London, UK. A US company; the server function may run outside the UK.'],
            ['Netlify, Inc.', 'Hosts the website and delivers it through its content delivery network', 'Request logs, including IP address and browser details. No workspace data.', 'Global edge network. A US company.'],
            ['Anthropic, PBC', 'Writes an AI explanation of one opportunity, only when you ask', 'That opportunity and its evidence (see AI below)', 'United States'],
            ['Email delivery provider', 'Sends sign-up confirmation and sign-in link emails', 'Your name and email address', 'To be confirmed. We will name it here.'],
          ]}
        />
        <p className="mt-4 max-w-[62ch] text-small text-ink-3">We will update this list before adding or replacing a subprocessor that handles the data you upload.</p>
      </PageSection>

      <PageSection id="infrastructure" title="Infrastructure" intro="Where Headroom runs and what our providers look after.">
        <Facts
          items={[
            { text: 'The website is static files served by Netlify. It holds no workspace data.' },
            { text: 'CSV files are read and contract PDF text is extracted in your browser. The analysis runs in your browser and the results are saved to your workspace.' },
            ...(HOSTED
              ? ([
                  { text: 'The database, sign-in and file storage run on Supabase in its London region.', tag: 'hosted' },
                  { text: <>Supabase encrypts stored data at rest. This is the provider's control, described in {ext('https://supabase.com/security', "Supabase's security documentation")}.</>, tag: 'provider' },
                  { text: 'Data you delete can remain in any database backups our provider keeps, until they expire. The backup schedule is not yet stated here (see Not in place yet).', tag: 'provider' },
                ] satisfies Fact[])
              : ([{ text: 'In evaluation mode nothing is stored on a server: the data lives in this browser and is gone when you clear it.', tag: 'evaluation' }] satisfies Fact[])),
            { text: 'Traffic between your browser and Headroom is encrypted with HTTPS.' },
          ]}
        />
      </PageSection>

      <PageSection id="ai" title="AI" intro={TRUST_COPY.ai}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <Sub>What AI does</Sub>
            <ul className="space-y-2.5 text-body text-ink-2">
              <li>Writes a plain-English explanation of one opportunity, when you click Explain.</li>
              <li>The explanation is labelled AI-assisted, with the model and the date it was written.</li>
            </ul>
          </div>
          <div>
            <Sub>What AI doesn't do</Sub>
            <ul className="space-y-2.5 text-body text-ink-2">
              <li>Find opportunities. Deterministic rules do that, and the same data always gives the same result.</li>
              <li>Produce, change or total any figure.</li>
              <li>Set a confidence level or a classification.</li>
              <li>Decide anything. {TRUST_COPY.review}</li>
            </ul>
          </div>
        </div>
        <Sub>What is sent, and the checks on what comes back</Sub>
        <Facts
          items={
            HOSTED
              ? [
                  { text: "Clicking Explain sends one opportunity to Anthropic's API from our server: the client name, the opportunity's title, description, value and recommended action, and its evidence, which can include ticket text, technician names and quoted contract sentences. This data is processed in the United States.", tag: 'hosted' },
                  { text: 'Nothing is sent unless you click. The API key stays on the server, and the request runs with your own sign-in, so the same access rules apply.' },
                  { text: "Quotes are checked word for word against your evidence. An explanation that introduces a number not in your data, or words such as \"owes\" or \"guaranteed\", is rejected and not saved." },
                  { text: 'Only the server can write the explanation. It is cleared when the opportunity it describes changes: its evidence, figures, wording or classification, or the client name.' },
                  { text: 'Explanations are limited per workspace each day, and per user each hour and each day.' },
                  { text: <>How Anthropic handles API data is set out in {ext('https://www.anthropic.com/legal/commercial-terms', "Anthropic's commercial terms")}.</>, tag: 'provider' },
                ]
              : [{ text: 'AI explanations are not available in evaluation mode or in the demo. Nothing is sent to an AI provider.', tag: 'evaluation' }]
          }
        />
      </PageSection>

      <PageSection id="evidence" title="Evidence and confidence" intro={<>{TRUST_COPY.confidence} These are the checks the engine applies to every opportunity.</>}>
        <Table
          caption="Confidence levels"
          head={['Level', 'Meaning']}
          rows={LEVEL_ORDER.map((l) => [CONFIDENCE[l].label, CONFIDENCE_DEFINITIONS[l]])}
        />
        <Sub>How each rule earns High confidence</Sub>
        <Table caption="Confidence by rule" head={['Rule', 'High when', 'Otherwise']} rows={RULE_CONFIDENCE} />
        <Sub>Classification</Sub>
        <Table caption="Classifications" head={['Classification', 'Meaning']} rows={CLASSIFICATION_ORDER.map((c) => [CLASSIFICATION[c].label, capitalise(CLASSIFICATION_DEFINITIONS[c].split(': ').slice(1).join(': '))])} />
        <p className="mt-4 max-w-[62ch] text-small text-ink-3">
          Each opportunity shows its evidence, the file and row (or contract and section) each line came from, and its calculation. Only High confidence opportunities count towards the High confidence
          total; Medium and Low are shown separately as requiring review. No opportunity is presented as money a client owes.
        </p>
      </PageSection>

      <PageSection id="deletion" title="Data deletion" intro="What each control deletes, and what it doesn't. The controls are in Settings under Data and privacy, and on the Analyses page.">
        <Table
          caption="Deletion controls"
          head={['Control', 'Deletes', 'Keeps']}
          rows={[
            [
              'Delete a source file',
              `The upload record${HOSTED ? ', its stored file' : ''} and the records imported from it`,
              'Clients that still have other records or opportunities you have decided on. Records imported before Headroom tracked which file each record came from (before 8 October 2026) stay; Clear all data removes them',
            ],
            ['Delete an analysis', 'That analysis run, its opportunities and its reports', 'Your data, other analyses and your tasks (unlinked)'],
            ['Clear all data', 'Every client, upload, contract file, analysis, opportunity, task and report', 'Your account, workspace name, settings and audit log'],
            ['Delete workspace', 'The workspace and everything in it, including the audit log', 'Your account'],
            ['Delete account', 'Your account, your workspace and everything in it', 'Nothing in the app'],
            ...(HOSTED ? [] : [['Sign out and remove data from this browser', "This browser's copy of your account and workspace", 'Nothing in this browser']]),
          ]}
        />
        <Facts
          items={[
            { text: 'Each deletion asks you to confirm, and says what will go.' },
            HOSTED
              ? { text: "Deleted data can remain in any backups our database provider keeps until they expire, and in provider request logs for the period they keep them. Backups are not used to restore deleted data except to recover from a fault.", tag: 'provider' }
              : { text: 'In evaluation mode a deletion removes the data from this browser. There is no server copy.', tag: 'evaluation' },
            { text: <>Before deleting, you can export opportunities as CSV and reports as PDF or CSV.</> },
          ]}
        />
      </PageSection>

      <PageSection id="contact" title="Security contact" intro="Found a vulnerability, or worried about your data?">
        <div className="max-w-[62ch] space-y-3 text-body text-ink-2">
          {contact ? (
            <p>
              Email{' '}
              <a href={`mailto:${contact}`} className={linkCls}>
                {contact}
              </a>{' '}
              with what you found and how to reproduce it.
            </p>
          ) : (
            <p>
              Write to us at our registered office: <span className="font-medium text-ink">{office}</span>. Mark your letter "Security" and include what you found and how to reproduce it. A dedicated
              security email address will be listed here when it is set up.
            </p>
          )}
          <p>Please don't access or change other customers' data, or disrupt the service, while testing.</p>
        </div>
      </PageSection>

      <PageSection id="roadmap" title="Not in place yet" intro="So you can judge for yourself. None of these is claimed anywhere on the site.">
        <Facts
          items={[
            { text: 'SOC 2 or ISO 27001 certification.' },
            { text: 'An independent penetration test.' },
            { text: 'Multi-factor authentication and single sign-on.' },
            { text: 'More than one user per workspace.' },
            { text: 'An automatic retention schedule.' },
            { text: 'A published database backup schedule and retention window.' },
            ...(COMPANY.contactEmail || COMPANY.securityEmail ? [] : [{ text: 'A support, privacy or security email address. Until one is listed, contact is by post to the registered office.' }]),
            { text: 'Analysis on the server. Figures are calculated in your browser and saved to your workspace, so a member could alter the stored figures of their own workspace (not anyone else\'s).' },
          ]}
        />
      </PageSection>
    </PublicPage>
  )
}
