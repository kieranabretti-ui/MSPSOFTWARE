import { COMPANY } from '../../brand/brand'
import { PublicPage } from '../trust/PublicPage'
import { wrap } from '../landing/primitives'
import { Markdown, parseMarkdown } from './Markdown'
import privacySource from './privacy.md?raw'
import termsSource from './terms.md?raw'

// The privacy policy (with its data processing annex) and the terms of
// service, rendered from privacy.md and terms.md. The contact line is filled
// from COMPANY: an email address once the owner supplies one, otherwise the
// registered office.

export const LEGAL_EFFECTIVE = '8 October 2026'
export const LEGAL_UPDATED = '8 October 2026'

export function contactLine() {
  return COMPANY.contactEmail ? `Email: [${COMPANY.contactEmail}](mailto:${COMPANY.contactEmail})` : 'Write to us at this address.'
}

export function fillLegal(source: string) {
  return source.replace(/\{\{CONTACT_LINE\}\}/g, contactLine())
}

function LegalPage({ title, docTitle, source, lead }: { title: string; docTitle: string; source: string; lead: string }) {
  const text = fillLegal(source)
  // The index lists the top-level sections (and the annex) that carry an anchor.
  const index = parseMarkdown(text)
    .filter((b): b is Extract<typeof b, { kind: 'h' }> => b.kind === 'h' && !!b.id && (b.level === 1 || !b.id.startsWith('dpa-')))
    .map((b) => ({ id: b.id!, label: b.text.replace(/^\d+\.\s*/, '') }))
  return (
    <PublicPage
      title={title}
      docTitle={docTitle}
      lead={<p>{lead}</p>}
      meta={
        <p className="tnum">
          Effective {LEGAL_EFFECTIVE} · Last updated {LEGAL_UPDATED}
        </p>
      }
      index={index}
    >
      <div className="border-t border-line-soft">
        <div className={`${wrap} py-12 lg:py-16`}>
          <Markdown source={text} />
        </div>
      </div>
    </PublicPage>
  )
}

export function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      docTitle="Privacy policy"
      source={privacySource}
      lead="What personal data Headroom collects, why, who else handles it, and your rights. The data processing annex for the data you upload is at the end."
    />
  )
}

export function Terms() {
  return <LegalPage title="Terms of service" docTitle="Terms" source={termsSource} lead="The agreement between Headroom and the business that uses it." />
}
