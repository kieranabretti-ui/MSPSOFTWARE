import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './Markdown'
import privacy from './privacy.md?raw'
import terms from './terms.md?raw'

// The published policies: no drafting notes left in, the anchors other pages
// link to exist, and nothing they say outruns the product.
describe('legal pages', () => {
  it('carry no drafting notes or unfilled placeholders other than the contact line', () => {
    for (const src of [privacy, terms]) {
      expect(src).not.toMatch(/CONFIRM|Draft for review|EFFECTIVE_DATE|CONTACT_EMAIL/)
      expect(src.replace(/\{\{CONTACT_LINE\}\}/g, '')).not.toMatch(/\{\{/)
      expect(src).not.toMatch(/—/)
    }
  })

  it('has the anchors the Trust Centre, terms and signup link to', () => {
    const ids = (src: string) => parseMarkdown(src).flatMap((b) => (b.kind === 'h' && b.id ? [b.id] : []))
    expect(ids(privacy)).toEqual(expect.arrayContaining(['dpa', 'ai', 'contact', 'subprocessors', 'retention']))
    expect(ids(terms)).toEqual(expect.arrayContaining(['contact', 'findings', 'ai']))
  })

  it('states the current password rule and makes no certification claim', () => {
    expect(privacy).toMatch(/at least 10 characters, with upper and lower case letters and a number/)
    expect(privacy).not.toMatch(/8 characters/)
    for (const src of [privacy, terms]) expect(src).not.toMatch(/SOC 2 (certified|compliant)|penetration tested|enterprise-grade/i)
  })

  it('parses tables and lists', () => {
    const blocks = parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n\n1. first\n2. second\n\nText **bold**.')
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'ul', 'ol', 'p'])
    expect(blocks[0]).toMatchObject({ head: ['A', 'B'], rows: [['1', '2']] })
  })
})

describe('deploy headers', () => {
  it('vercel.json sends the same headers as public/_headers', () => {
    const fromHeaders = Object.fromEntries(
      readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8')
        .split('\n')
        .flatMap((l) => {
          const m = /^ {2}([A-Za-z-]+): (.*)$/.exec(l)
          return m ? [[m[1], m[2]]] : []
        }),
    )
    const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as { headers: { headers: { key: string; value: string }[] }[] }
    const fromVercel = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))
    expect(fromVercel).toEqual(fromHeaders)
    expect(fromVercel['Content-Security-Policy']).toBeTruthy()
  })
})
