import { useEffect, type ReactNode } from 'react'
import { COMPANY } from '../brand/brand'
import { Close, Footer, TopBar } from './landing/chrome'
import { Section, wrap } from './landing/primitives'

// How Headroom handles an MSP's data, in sentences the code backs. Nothing
// here claims a hosting region, retention period, certification, encryption
// scheme or uptime: those are the owner's to state, and the contact lines
// appear only once COMPANY has the addresses.

const GROUPS: { id: string; title: string; lines: ReactNode[] }[] = [
  {
    id: 'needs',
    title: 'What Headroom needs',
    lines: [
      'Headroom works from files you choose to export and upload: clients, tickets, time entries, users and devices, billing lines, and contract PDFs.',
      "It doesn't connect to your PSA, RMM or accounting system, and needs no agent, admin account or API credentials.",
      "You map each file's columns before anything is imported.",
    ],
  },
  {
    id: 'processing',
    title: "Where it's processed",
    lines: [
      "CSV files are read in your browser. Only the rows you map are saved; the original CSV file isn't uploaded.",
      'Text is extracted from contract PDFs in your browser.',
      "The analysis is a deterministic rules engine that runs in your browser. The same data always gives the same opportunities, and no AI model decides what is an opportunity or what it's worth.",
    ],
  },
  {
    id: 'storage',
    title: 'Accounts, storage and isolation',
    lines: [
      'Sign-in uses Supabase Auth: email and password (at least 8 characters) or a one-time email link.',
      'Your data is stored in Postgres with row-level security on every table. Every row carries your workspace ID, and the database returns rows only to signed-in members of that workspace.',
      'Workspaces are created only through a database function that makes you the owner. Nobody can add themselves to another workspace.',
      'Contract PDFs are kept in a private storage bucket, in a folder for your workspace that only its members can read.',
    ],
  },
  {
    id: 'demo',
    title: 'The demo and evaluation mode',
    lines: [
      'The demo runs entirely in your browser on fictional data. Nothing you do in it is sent to a server.',
      'If Headroom runs without its server (evaluation mode), accounts and data are stored only in that browser, without a server-side login. Use it to evaluate the product, not for client data.',
    ],
  },
  {
    id: 'ai',
    title: 'AI, only when you ask',
    lines: [
      'AI runs only when you click Explain this opportunity on a single opportunity.',
      "That sends one opportunity to Anthropic's Claude API: the client name, the opportunity's title, description, value, confidence and recommended action, and its evidence, including ticket text, time entries with technician names, and quoted contract sentences.",
      'The API key is held on the server and never reaches your browser. The request runs with your own sign-in, so the same access rules apply.',
      "Any quote that doesn't appear word for word in your evidence is removed before you see it.",
      'The explanation is saved with the opportunity.',
      <>
        How Anthropic handles API requests is set out in{' '}
        <a
          href="https://www.anthropic.com/legal/commercial-terms"
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
        >
          Anthropic's commercial terms
        </a>
        .
      </>,
    ],
  },
  {
    id: 'export',
    title: 'Export and deletion',
    lines: [
      'You can export opportunities as CSV, and the report as PDF or CSV, at any time.',
      'Clear data permanently removes every client, upload record, opportunity, task and report in your workspace, along with the contract files stored for it.',
      `Deleting your account isn't self-serve yet.${COMPANY.contactEmail ? ` Email ${COMPANY.contactEmail} and we'll delete it.` : ''}`,
    ],
  },
  {
    id: 'not-yet',
    title: "What Headroom doesn't have yet",
    lines: [
      "Headroom isn't SOC 2 or ISO 27001 certified and hasn't had an independent penetration test.",
      "There's no single sign-on or multi-factor authentication in the app yet, and each workspace has one user.",
      "There's no automatic retention schedule: data stays until you clear it.",
      "There's no audit log of who changed what.",
    ],
  },
  ...(COMPANY.securityEmail
    ? [
        {
          id: 'report',
          title: 'Report a security issue',
          lines: [
            <>
              Email{' '}
              <a href={`mailto:${COMPANY.securityEmail}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink">
                {COMPANY.securityEmail}
              </a>{' '}
              with what you found and how to reproduce it.
            </>,
          ],
        },
      ]
    : []),
]

export default function Security() {
  useEffect(() => {
    const before = document.title
    document.title = 'Security · Headroom'
    return () => {
      document.title = before
    }
  }, [])

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only rounded-md bg-raised text-body font-medium text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <TopBar />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <div className={`${wrap} pb-12 pt-14 sm:pt-20 lg:pb-14 lg:pt-24`}>
          <h1 className="max-w-[20ch] text-balance text-[length:clamp(2.25rem,1.4rem+3vw,3.75rem)] font-semibold leading-[1.02] tracking-(--type-display-tracking) text-ink">
            How Headroom handles your data
          </h1>
          <p className="mt-6 max-w-[60ch] text-lead text-ink-2">
            Headroom is early-stage software. This page sets out exactly what it does with your data today, and what it doesn't do yet.
          </p>
          <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
            {GROUPS.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="rounded-sm text-small text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline">
                {g.title}
              </a>
            ))}
          </nav>
        </div>

        <Section>
          <div>
            {GROUPS.map((g) => (
              <section
                key={g.id}
                id={g.id}
                aria-labelledby={`${g.id}-title`}
                className="grid scroll-mt-20 grid-cols-1 gap-x-12 gap-y-4 border-t border-line-soft py-8 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-12 lg:py-10"
              >
                <h2 id={`${g.id}-title`} className="text-h2 text-ink lg:col-span-4">
                  {g.title}
                </h2>
                <ul className="space-y-3 lg:col-span-8">
                  {g.lines.map((line, i) => (
                    <li key={i} className="max-w-[68ch] text-body text-ink-2 sm:text-lead">
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Section>

        <Close />
      </main>

      <Footer />
    </div>
  )
}
