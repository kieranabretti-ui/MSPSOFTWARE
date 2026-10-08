import { useEffect, useState } from 'react'
import { MessageSquareText, RotateCcw } from 'lucide-react'
import { Button, Card, CardHeader } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { useStore } from '../../../data/store'
import { mapError } from '../../../lib/errors'
import { dateTime } from '../../../lib/format'
import { evidenceFingerprint, sha256Hex } from '../../../../supabase/functions/ai-review/guard'
import type { Finding } from '../../../engine/types'
import { AI_LINE } from './EvidenceView'

// Postgres jsonb stores object keys ordered by length, then bytewise. The
// ai-review function hashes the finding as read back from the database, so the
// same ordering is applied here before comparing.
function jsonbOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(jsonbOrder)
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((k) => [k, jsonbOrder((v as Record<string, unknown>)[k])]))
  }
  return v
}

type Freshness = 'checking' | 'current' | 'stale' | 'unversioned'

// Whether the stored explanation was written for the evidence on screen now.
function useFreshness(f: Finding, justWritten: boolean): Freshness {
  const hash = f.ai_meta?.evidence_hash ?? null
  const fp = f.ai_explanation && hash ? evidenceFingerprint(f) : null
  const ordered = fp ? evidenceFingerprint(jsonbOrder({ ...f }) as Finding) : null
  const [state, setState] = useState<{ key: string | null; value: Freshness }>({ key: null, value: 'checking' })
  useEffect(() => {
    if (!fp || !hash || !ordered) return
    let live = true
    Promise.all([sha256Hex(fp), sha256Hex(ordered)])
      .then(([a, b]) => live && setState({ key: fp, value: a === hash || b === hash ? 'current' : 'stale' }))
      .catch(() => live && setState({ key: fp, value: 'current' }))
    return () => {
      live = false
    }
  }, [fp, ordered, hash])
  if (justWritten) return 'current'
  if (!f.ai_explanation) return 'current'
  if (!hash) return 'unversioned'
  return state.key === fp ? state.value : 'checking'
}

// The optional AI explanation of one finding. Labelled as AI-assisted
// interpretation, with the model and when it was written; hidden once the
// evidence has changed since, so it can never describe superseded figures.
export function AiExplanation({ finding: f }: { finding: Finding }) {
  const { backend, setFindingExplanation } = useStore()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [written, setWritten] = useState<{ id: string; at: string } | null>(null)
  const justWritten = written?.id === f.id
  const freshness = useFreshness(f, justWritten)
  const aiReady = backend.mode === 'supabase' && !!backend.aiReview

  if (!aiReady && !f.ai_explanation) return null

  const explain = async () => {
    if (backend.mode !== 'supabase' || !backend.aiReview) return
    setLoading(true)
    try {
      const res: unknown = await backend.aiReview(f.id)
      const text = typeof res === 'string' ? res : ((res as { explanation?: string } | null)?.explanation ?? '')
      if (text) await setFindingExplanation(f.id, text)
      setWritten({ id: f.id, at: new Date().toISOString() })
    } catch (err) {
      toast(mapError(err, 'ai'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const meta = f.ai_meta
  const showText = !!f.ai_explanation && (freshness === 'current' || freshness === 'unversioned')

  return (
    <Card>
      <CardHeader as="h2" title="AI-assisted interpretation" subtitle="Optional. A plain-English read of the evidence, not a source of any figure." />
      <div className="px-5 py-4">
        {showText ? (
          <>
            <blockquote className="whitespace-pre-line border-l-2 border-line-strong pl-3.5 text-body leading-relaxed text-ink-2">{f.ai_explanation}</blockquote>
            <p className="tnum mt-3 text-caption text-ink-3">
              {meta ? `${meta.model} · written ${dateTime(meta.generated_at)}` : justWritten && written ? `Written ${dateTime(written.at)}` : 'Written before explanations recorded their model and date.'}
            </p>
            {freshness === 'unversioned' && !justWritten && <p className="mt-1 text-caption text-ink-3">It may not reflect the latest analysis. Check it against the evidence.</p>}
          </>
        ) : f.ai_explanation && freshness === 'stale' ? (
          <>
            <p className="text-small font-medium text-ink">Out of date</p>
            <p className="mt-1 text-small leading-relaxed text-ink-2">The evidence changed after this explanation was written, so it is hidden.</p>
            {aiReady && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={explain} loading={loading}>
                {!loading && <RotateCcw className="size-4" aria-hidden />} Explain again
              </Button>
            )}
          </>
        ) : f.ai_explanation ? (
          <p className="text-small text-ink-3">Checking the explanation against the current evidence…</p>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={explain} loading={loading}>
              {!loading && <MessageSquareText className="size-4" aria-hidden />} Explain (AI-assisted)
            </Button>
            <p className="mt-3 text-caption leading-relaxed text-ink-3">
              Sends this one opportunity and its evidence, including any names in the ticket and time entries, to Anthropic's Claude API, processed in the United States. Nothing else in your workspace is sent.
            </p>
          </>
        )}
        <p className="mt-3 border-t border-line-soft pt-3 text-caption leading-relaxed text-ink-3">{AI_LINE} Check it against the evidence before acting.</p>
      </div>
    </Card>
  )
}
