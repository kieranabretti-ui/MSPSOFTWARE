import type { Interval, PlanId } from '../billing/plans'
import type { Category, ConfidenceLevel, FindingStatus } from '../engine/types'

// Product analytics, provider-agnostic and cookieless. Events carry counts and
// categories only: never emails, client names, opportunity titles or £ values.
// In development they're logged to the console; in production they're sent
// with sendBeacon to VITE_TRACK_ENDPOINT when that's set, and dropped when it
// isn't. Nothing is stored in cookies or browser storage.

export interface TrackEvents {
  cta_click: { location: string; label: string; to: string }
  audit_request: { plan?: string }
  demo_started: Record<never, never>
  signup_completed: { needs_confirmation: boolean; intent?: string }
  workspace_created: Record<never, never>
  upload_completed: { kind: 'clients' | 'tickets' | 'time_entries' | 'assets' | 'billing'; rows: number; added: number; updated: number; errors: number }
  analysis_started: { source: AnalysisSource }
  analysis_completed: { source: AnalysisSource; opportunities: number; high: number; medium: number; low: number; duration_ms: number }
  finding_viewed: { category: Category; level: ConfidenceLevel }
  finding_stage_changed: { from: FindingStatus; to: FindingStatus; category: Category; via: 'detail' | 'queue' }
  report_downloaded: { format: 'pdf' | 'csv' | 'print' }
  pricing_viewed: Record<never, never>
  pricing_interval_changed: { interval: Interval }
  // Interest in a paid plan, recorded while checkout isn't built.
  plan_selected: { plan: PlanId; interval: Interval; location: string }
  upgrade_clicked: { plan: PlanId; from: PlanId; interval: Interval; location: string }
}

export type AnalysisSource = 'manual' | 'first_run' | 'settings' | 'demo'
export type TrackName = keyof TrackEvents

export interface TrackContext {
  is_demo: boolean
  mode: 'local' | 'supabase'
}

export type TrackPayload<K extends TrackName = TrackName> = TrackEvents[K] & TrackContext & { event: K; path: string; ts: string }
type Sink = (payload: TrackPayload) => void

let context: TrackContext = { is_demo: false, mode: 'local' }
const sinks = new Set<Sink>()
const ENDPOINT = import.meta.env.VITE_TRACK_ENDPOINT as string | undefined

export function setTrackContext(ctx: TrackContext) {
  context = { ...ctx }
}

// Returns a function that removes the sink.
export function addSink(fn: Sink): () => void {
  sinks.add(fn)
  return () => {
    sinks.delete(fn)
  }
}

// Events with no properties can be sent with none.
type Args<K extends TrackName> = keyof TrackEvents[K] extends never ? [props?: TrackEvents[K]] : [props: TrackEvents[K]]

// Record ids are never sent: a UUID in the path is replaced with :id.
export const scrubPath = (path: string) => path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')

export function track<K extends TrackName>(name: K, ...[props]: Args<K>): void {
  try {
    const payload = { ...(props ?? {}), ...context, event: name, path: typeof location === 'undefined' ? '' : scrubPath(location.pathname), ts: new Date().toISOString() } as unknown as TrackPayload<K>
    if (import.meta.env.DEV) console.debug('[track]', name, payload)
    if (ENDPOINT && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') navigator.sendBeacon(ENDPOINT, JSON.stringify(payload))
    for (const sink of sinks) {
      try {
        sink(payload as unknown as TrackPayload)
      } catch {
        /* a broken sink never breaks the app */
      }
    }
  } catch {
    /* analytics never breaks the app */
  }
}
