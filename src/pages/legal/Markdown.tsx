import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { linkCls } from '../trust/PublicPage'

// A small renderer for the legal pages' markdown (privacy.md, terms.md), so the
// policy text stays a plain document the owner and a solicitor can edit. It
// handles only what those files use: headings with {#id} anchors, paragraphs,
// bullet and numbered lists, tables, a rule, **bold**, `code` and [links](/x).

type Block =
  | { kind: 'h'; level: 1 | 2; text: string; id?: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'hr' }

const HEADING = /^(#{1,2})\s+(.*?)(?:\s+\{#([\w-]+)\})?\s*$/
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

export function parseMarkdown(src: string): Block[] {
  const out: Block[] = []
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      out.push({ kind: 'h', level: h[1].length as 1 | 2, text: h[2], id: h[3] })
      i++
    } else if (/^---+\s*$/.test(line)) {
      out.push({ kind: 'hr' })
      i++
    } else if (line.trimStart().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        if (!/^\s*\|[\s|:-]+\|\s*$/.test(lines[i])) rows.push(cells(lines[i]))
        i++
      }
      out.push({ kind: 'table', head: rows[0] ?? [], rows: rows.slice(1) })
    } else if (/^(-|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^(-|\d+\.)\s+/, ''))
        i++
      }
      out.push({ kind: ordered ? 'ol' : 'ul', items })
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !/^(-|\d+\.)\s|^\||^---/.test(lines[i].trimStart())) {
        para.push(lines[i].trim())
        i++
      }
      out.push({ kind: 'p', text: para.join(' ') })
    }
  }
  return out
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

export function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE).filter(Boolean)
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p.startsWith('**')) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        if (p.startsWith('`')) return <code key={i} className="rounded-xs bg-sunken px-1 py-0.5 text-[0.9em] text-ink">{p.slice(1, -1)}</code>
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p)
        if (m) {
          const [, label, href] = m
          return href.startsWith('/') ? (
            <Link key={i} to={href} className={linkCls}>
              {label}
            </Link>
          ) : (
            <a key={i} href={href} className={linkCls} rel="noreferrer">
              {label}
            </a>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="max-w-[46rem] text-body text-ink-2">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return b.level === 1 ? (
              <h2 key={i} id={b.id} className="mt-16 scroll-mt-20 text-h1 text-balance text-ink first:mt-0">
                <Inline text={b.text} />
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="mt-10 scroll-mt-20 text-h2 text-balance text-ink first:mt-0">
                <Inline text={b.text} />
              </h3>
            )
          case 'p':
            return (
              <p key={i} className="mt-4 max-w-[68ch]">
                <Inline text={b.text} />
              </p>
            )
          case 'ul':
          case 'ol': {
            const List = b.kind === 'ul' ? 'ul' : 'ol'
            return (
              <List key={i} className={`mt-4 max-w-[68ch] space-y-2 pl-5 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-ink-3`}>
                {b.items.map((it, j) => (
                  <li key={j} className="pl-1">
                    <Inline text={it} />
                  </li>
                ))}
              </List>
            )
          }
          case 'table':
            return (
              <div key={i} className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[36rem] text-small">
                  <thead>
                    <tr className="border-b border-line">
                      {b.head.map((c, j) => (
                        <th key={j} scope="col" className="py-2.5 pr-4 text-left align-bottom text-label uppercase text-ink-3 last:pr-0">
                          <Inline text={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className="py-3 pr-4 align-top text-ink-2 last:pr-0">
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            return <hr key={i} className="mt-16 border-line" />
        }
      })}
    </div>
  )
}
