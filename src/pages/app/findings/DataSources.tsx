import { Link } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { dateTime, plural } from '../../../lib/format'
import type { Finding } from '../../../engine/types'
import { SETTING_LABEL, TABLE_NOUN, allRefs, filesOf, refRoute, rowRanges, ruleInfo, sourceOf } from './rules'

const linkCls = 'font-medium text-ink underline decoration-ink-4 underline-offset-4 transition-colors hover:decoration-ink'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="tnum min-w-0 text-small text-ink-2">{children}</dd>
    </div>
  )
}

// The files, agreements and settings this finding was built from, the rule
// that produced it and the analysis run, so it can be reproduced.
export function DataSources({ finding: f }: { finding: Finding }) {
  const { data } = useStore()
  const refs = allRefs(f)
  const files = filesOf(refs, data.uploads)
  const clauses = [...new Map(refs.filter((r) => r.table === 'contracts').map((r) => [`${r.id}:${r.section ?? ''}`, r])).values()]
  const unfiled = [...new Map(refs.filter((r) => r.table !== 'contracts' && !r.file_name).map((r) => [`${r.table}:${r.id}`, r])).values()]
  const settingKeys = [...new Set(f.evidence.flatMap((e) => (sourceOf(e) === 'settings' ? (e.setting_keys ?? []) : [])))]
  const analysis = data.analyses.find((a) => a.id === f.analysis_id)
  const rule = ruleInfo(f.meta.rule)

  return (
    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading" className="text-h3 text-ink">
        Data sources
      </h2>
      <dl className="mt-3 divide-y divide-line-soft">
        {files.map((s) => (
          <Row key={s.key} label={[...s.tables].map((t) => TABLE_NOUN[t][1]).join(', ').replace(/^./, (c) => c.toUpperCase())}>
            <Link to="/app/analyses" className={linkCls}>
              {s.file_name}
            </Link>
            <span className="text-ink-3">
              {' '}
              · {plural(s.count, 'record')}
              {s.rows.length ? `, ${s.rows.length === 1 ? 'row' : 'rows'} ${rowRanges(s.rows)}` : ''}
              {s.upload ? ` · imported ${dateTime(s.upload.created_at)}` : ''}
            </span>
          </Row>
        ))}
        {clauses.length > 0 && (
          <Row label="Agreement">
            <ul className="space-y-0.5">
              {clauses.map((r, i) => {
                const to = refRoute(r, data.contracts)
                return (
                  <li key={i}>
                    {to ? (
                      <Link to={to} className={linkCls}>
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                    {r.page ? <span className="text-ink-3">, page {r.page}</span> : null}
                  </li>
                )
              })}
            </ul>
          </Row>
        )}
        {unfiled.length > 0 && (
          <Row label="Other records">
            {plural(unfiled.length, 'record')} with no source file recorded (added by hand, or imported before files were tracked)
          </Row>
        )}
        {settingKeys.length > 0 && (
          <Row label="Settings">
            {settingKeys.map((k) => SETTING_LABEL[k] ?? k).join(', ')}.{' '}
            <Link to="/app/settings" className={linkCls}>
              Settings
            </Link>
          </Row>
        )}
        <Row label="Rule">
          {rule?.name ?? 'Rule'} <code className="ml-1 rounded-xs bg-raised px-1.5 py-0.5 font-mono text-caption text-ink-2">{f.meta.rule}</code>
        </Row>
        {analysis && <Row label="Analysis run">{dateTime(analysis.created_at)}</Row>}
      </dl>
    </section>
  )
}
