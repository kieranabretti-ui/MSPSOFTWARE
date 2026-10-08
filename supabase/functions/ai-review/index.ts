// AI review for a single finding.
//
// The rules engine decides what is a finding and what it is worth. This
// function only explains an existing finding in plain English for an account
// manager, using nothing but the evidence the engine already attached.
//
// Boundaries, in order:
// 1. CORS fails closed: only origins listed in SITE_URL (localhost only when
//    running against a local Supabase).
// 2. The caller's JWT is verified (verify_jwt in config.toml and getUser
//    here) and the finding is read with that JWT, so Row Level Security
//    decides whether they can see it. A finding outside their workspaces
//    simply isn't found.
// 3. Cost limits: a stored explanation for the same evidence is returned
//    without calling the model; otherwise ai_take_quota() enforces a
//    per-workspace daily cap and per-user hourly and daily caps atomically.
// 4. Uploaded text is XML-escaped and wrapped in one <data> element that the
//    system prompt marks as untrusted data, never instructions.
// 5. The answer is checked: quotes must appear verbatim in the evidence,
//    every number must already be in the data (the model may not calculate),
//    and wording that claims money is owed is refused.
// 6. The explanation and ai_meta {model, generated_at, evidence_hash} are
//    written here with the service role. The browser can't write those
//    columns (migration 20261008000100), so text shown as AI-assisted really
//    came from this function. The ai.explained audit event is written here
//    too.
// 7. Errors: the browser gets a fixed message; logs get an error class and
//    status only, never finding content or provider error bodies.
//
// Secrets (function secrets, never sent to the browser): ANTHROPIC_API_KEY,
// SITE_URL. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase. Optional: AI_WORKSPACE_DAILY_LIMIT (default 50),
// AI_USER_HOURLY_LIMIT (default 20), AI_USER_DAILY_LIMIT (default 60).

import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { allowedOrigin, buildPrompt, checkOutput, evidenceFingerprint, isLocalSupabase, sha256Hex, SYSTEM, type EvidenceItem, type FindingForPrompt } from './guard.ts'

const MODEL = 'claude-opus-5-5'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const LOCAL_DEV = isLocalSupabase(SUPABASE_URL)
const SITE_URL = Deno.env.get('SITE_URL')
if (!SITE_URL && !LOCAL_DEV) console.warn('ai-review: SITE_URL is not set, so no browser origin is allowed. Set it with `supabase secrets set SITE_URL=https://your-app`.')

const intEnv = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name))
  return Number.isInteger(n) && n > 0 ? n : fallback
}
const LIMITS = {
  workspaceDaily: intEnv('AI_WORKSPACE_DAILY_LIMIT', 50),
  userHourly: intEnv('AI_USER_HOURLY_LIMIT', 20),
  userDaily: intEnv('AI_USER_DAILY_LIMIT', 60),
}

const corsFor = (req: Request): Record<string, string> => {
  const origin = allowedOrigin(req.headers.get('Origin'), SITE_URL, LOCAL_DEV)
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

// Logs what failed without its content: an error class, a code and a
// status. Provider and database error messages can echo request data.
const logFailure = (where: string, e: unknown) => {
  const o = (e ?? {}) as { name?: unknown; code?: unknown; status?: unknown; request_id?: unknown; requestID?: unknown }
  console.error(
    JSON.stringify({
      fn: 'ai-review',
      where,
      name: typeof o.name === 'string' ? o.name : typeof e,
      code: typeof o.code === 'string' || typeof o.code === 'number' ? o.code : undefined,
      status: typeof o.status === 'number' ? o.status : undefined,
      request_id: typeof o.request_id === 'string' ? o.request_id : typeof o.requestID === 'string' ? o.requestID : undefined,
    }),
  )
}

const MESSAGES = {
  failed: "The AI explanation couldn't be generated. Try again.",
  notSetUp: "AI explanations aren't set up on this server.",
  signIn: 'Sign in to use AI explanations.',
  badRequest: 'Invalid request.',
  notFound: "We couldn't find that opportunity. It may have been removed when the analysis was re-run.",
  busy: 'The AI explanation service is busy. Try again in a minute.',
  workspaceDaily: "This workspace has reached today's limit for AI explanations. Try again tomorrow.",
  userLimit: "You've reached the limit for AI explanations for now. Try again later.",
  refused: "The AI couldn't explain this opportunity. The evidence and calculation above are unaffected.",
  checks: "The AI explanation didn't pass our checks (it used figures or wording that aren't in the evidence), so it wasn't saved. Try again, or review the evidence directly.",
  origin: 'This origin is not allowed.',
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    return await handle(req, cors, json)
  } catch (e) {
    logFailure('unhandled', e)
    return json({ error: MESSAGES.failed }, 500)
  }
})

type Json = (body: unknown, status?: number) => Response

async function handle(req: Request, cors: Record<string, string>, json: Json): Promise<Response> {
  // A browser call from an origin we don't serve is refused outright.
  if (req.headers.get('Origin') && !cors['Access-Control-Allow-Origin']) return json({ error: MESSAGES.origin }, 403)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !anonKey || !serviceKey || !SUPABASE_URL) return json({ error: MESSAGES.notSetUp }, 503)

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: MESSAGES.signIn }, 401)

  if (Number(req.headers.get('Content-Length') ?? 0) > 4096) return json({ error: MESSAGES.badRequest }, 413)
  let body: { finding_id?: unknown; regenerate?: unknown }
  try {
    body = (await req.json()) ?? {}
  } catch {
    return json({ error: MESSAGES.badRequest }, 400)
  }
  const findingId = body.finding_id
  const regenerate = body.regenerate === true
  if (typeof findingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(findingId)) return json({ error: MESSAGES.badRequest }, 400)

  // The caller, as RLS sees them.
  const asUser = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await asUser.auth.getUser(authorization.slice(7))
  const user = userData?.user
  if (userError || !user) return json({ error: MESSAGES.signIn }, 401)

  // RLS returns the row only if the caller is a member of its workspace.
  const { data: finding, error } = await asUser
    .from('findings')
    .select('id, workspace_id, category, title, description, evidence, estimated_value, monthly_value, annual_value, meta, recommended_action, claims, classification, severity, confidence, ai_explanation, ai_meta, updated_at, client_id')
    .eq('id', findingId)
    .maybeSingle()
  if (error) {
    logFailure('read_finding', error)
    return json({ error: MESSAGES.failed }, 500)
  }
  if (!finding) return json({ error: MESSAGES.notFound }, 404)

  const { data: client } = await asUser.from('clients').select('name').eq('id', finding.client_id).maybeSingle()
  const evidence = (Array.isArray(finding.evidence) ? finding.evidence : []) as EvidenceItem[]
  const input: FindingForPrompt = {
    client: (client as { name?: string } | null)?.name ?? 'Unknown client',
    category: finding.category,
    title: finding.title,
    description: finding.description,
    estimated_value: finding.estimated_value,
    monthly_value: finding.monthly_value,
    recommended_action: finding.recommended_action,
    evidence,
  }
  const evidenceHash = await sha256Hex(evidenceFingerprint(finding))

  // Already explained for exactly this evidence: no model call, no quota.
  const stored = finding.ai_meta as { model?: string; generated_at?: string; evidence_hash?: string } | null
  if (!regenerate && finding.ai_explanation && stored?.evidence_hash === evidenceHash) {
    return json({ explanation: finding.ai_explanation, ai_meta: stored, cached: true })
  }

  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: quota, error: quotaError } = await admin.rpc('ai_take_quota', {
    p_workspace: finding.workspace_id,
    p_user: user.id,
    p_finding: finding.id,
    p_workspace_daily: LIMITS.workspaceDaily,
    p_user_hourly: LIMITS.userHourly,
    p_user_daily: LIMITS.userDaily,
  })
  if (quotaError) {
    logFailure('quota', quotaError)
    return json({ error: MESSAGES.failed }, 500)
  }
  const q = (Array.isArray(quota) ? quota[0] : quota) as { usage_id: number | null; reason: string | null } | undefined
  if (!q?.usage_id) {
    if (q?.reason === 'not_member') return json({ error: MESSAGES.notFound }, 404)
    const retry = q?.reason === 'workspace_daily' || q?.reason === 'user_daily' ? 86400 : 3600
    return new Response(JSON.stringify({ error: q?.reason === 'workspace_daily' ? MESSAGES.workspaceDaily : MESSAGES.userLimit }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(retry) },
    })
  }
  const usageId = q.usage_id
  const finish = async (status: 'ok' | 'failed', usage?: { input_tokens?: number; output_tokens?: number }, model?: string) => {
    const { error: e } = await admin
      .from('ai_usage')
      .update({ status, model: model ?? null, input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null })
      .eq('id', usageId)
    if (e) logFailure('usage_update', e)
  }

  const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 })
  let response: Anthropic.Beta.Messages.BetaMessage
  try {
    // `fallbacks: "default"` lets the API re-run a declined request on Anthropic's
    // recommended fallback model; it needs its own beta header.
    response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    })
  } catch (e) {
    logFailure('model', e)
    await finish('failed')
    if (e instanceof Anthropic.RateLimitError) return json({ error: MESSAGES.busy }, 429)
    return json({ error: MESSAGES.failed }, 502)
  }
  await finish(response.stop_reason === 'end_turn' ? 'ok' : 'failed', response.usage, response.model)

  if (response.stop_reason === 'refusal') return json({ error: MESSAGES.refused }, 422)
  if (response.stop_reason !== 'end_turn') {
    logFailure('stop_reason', { name: String(response.stop_reason) })
    return json({ error: MESSAGES.failed }, 502)
  }

  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    logFailure('parse', e)
    return json({ error: MESSAGES.failed }, 502)
  }

  const checked = checkOutput(parsed, input)
  if (!checked.ok) {
    // Problem codes only (e.g. "unsupported_numbers:2"), never the text.
    console.warn(JSON.stringify({ fn: 'ai-review', where: 'checks', problems: checked.problems }))
    return json({ error: MESSAGES.checks }, 422)
  }

  const aiMeta = { model: response.model, generated_at: new Date().toISOString(), evidence_hash: evidenceHash }
  // Written by the service role, scoped to the workspace RLS already
  // confirmed, and only if the finding hasn't changed since it was read (the
  // database also clears AI text whenever evidence or values change).
  const { data: saved, error: saveError } = await admin
    .from('findings')
    .update({ ai_explanation: checked.text, ai_meta: aiMeta })
    .eq('id', finding.id)
    .eq('workspace_id', finding.workspace_id)
    .eq('updated_at', finding.updated_at)
    .select('id')
  if (saveError) {
    logFailure('save', saveError)
    return json({ error: MESSAGES.failed }, 500)
  }
  if (!saved?.length) return json({ error: MESSAGES.notFound }, 409)

  const { error: auditError } = await admin.from('audit_log').insert({
    workspace_id: finding.workspace_id,
    actor_id: user.id,
    action: 'ai.explained',
    target_type: 'finding',
    target_id: finding.id,
    detail: { model: response.model, evidence_items: evidence.length, quotes_kept: checked.quotes.length, quotes_dropped: checked.dropped_quotes },
  })
  if (auditError) logFailure('audit', auditError)

  return json({ explanation: checked.text, quotes: checked.quotes, dropped_quotes: checked.dropped_quotes, model: response.model, ai_meta: aiMeta })
}

const SCHEMA = {
  type: 'object',
  properties: {
    explanation: {
      type: 'string',
      description: 'Two to four sentences in plain English explaining why this may be unbilled or underpriced work. No numbers that are not copied exactly from the data.',
    },
    quotes: {
      type: 'array',
      description: 'Short verbatim excerpts copied exactly from the evidence that support the explanation.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'The label of the evidence item the excerpt was copied from.' },
          text: { type: 'string', description: 'The excerpt, copied character for character.' },
        },
        required: ['label', 'text'],
        additionalProperties: false,
      },
    },
    caveat: {
      type: 'string',
      description: 'One sentence on what the account manager should confirm before raising this with the client.',
    },
  },
  required: ['explanation', 'quotes', 'caveat'],
  additionalProperties: false,
}
