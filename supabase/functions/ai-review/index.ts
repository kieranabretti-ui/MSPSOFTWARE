// AI review for a single finding.
//
// The rules engine decides what is a finding and what it is worth. This
// function only explains an existing finding in plain English for an account
// manager, using nothing but the evidence the engine already attached. Any
// quote the model returns is checked against that evidence and dropped if it
// does not appear there verbatim, so the explanation can never cite evidence
// that does not exist.
//
// Secrets: ANTHROPIC_API_KEY is a Supabase function secret and never reaches
// the browser. The caller's JWT is forwarded so Row Level Security decides
// whether they can read the finding.

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'claude-opus-5-5'

// SITE_URL (a function secret) limits browser calls to the app's own origin.
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// What the browser sees when something unexpected fails. The raw error goes
// to the function logs only.
const FAILED = "The AI explanation couldn't be generated. Try again."
const failed = (raw: unknown) => {
  console.error(raw)
  return json({ error: FAILED }, 500)
}

interface Evidence {
  kind: string
  label: string
  text: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    explanation: {
      type: 'string',
      description: 'Two to four sentences in plain English explaining why this may be unbilled or underpriced work.',
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

const SYSTEM = `You help managed service providers review possible revenue leakage found by a rules engine.
You will be given one finding and the evidence the engine attached to it.
Explain to an account manager, in plain British English, why this work may be billable or underpriced.
Use only facts that appear in the finding or its evidence. Do not introduce figures, dates, names or contract terms that are not there.
Present the value as potential, never as money that is definitely owed.
Every quote must be copied exactly from one evidence item's text.`

const normalise = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (e) {
    return failed(e)
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: "AI explanations aren't set up on this server." }, 503)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Not signed in.' }, 401)

  let findingId: unknown
  try {
    findingId = (await req.json())?.finding_id
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (typeof findingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(findingId)) return json({ error: 'finding_id is required.' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: finding, error } = await supabase
    .from('findings')
    .select('id, category, severity, confidence, title, description, evidence, estimated_value, monthly_value, recommended_action, client:clients(name)')
    .eq('id', findingId)
    .maybeSingle()
  if (error) return failed(error)
  if (!finding) return json({ error: "We couldn't find that opportunity. It may have been removed when the analysis was re-run." }, 404)

  const evidence = (finding.evidence ?? []) as Evidence[]
  const client = (finding.client as { name?: string } | null)?.name ?? 'Unknown client'
  const prompt = [
    `Client: ${client}`,
    `Category: ${finding.category}`,
    `Title: ${finding.title}`,
    `Engine description: ${finding.description}`,
    `Estimated potential value: £${finding.estimated_value}${Number(finding.monthly_value) > 0 ? ` (about £${finding.monthly_value} a month if uncorrected)` : ''}`,
    `Engine confidence: ${finding.confidence}%`,
    `Recommended action: ${finding.recommended_action}`,
    '',
    'Evidence:',
    ...evidence.map((e, i) => `<evidence index="${i + 1}" kind="${e.kind}" label="${e.label}">\n${e.text}\n</evidence>`),
  ].join('\n')

  const anthropic = new Anthropic({ apiKey })
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
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI explanation service is busy. Try again in a minute.' }, 429)
    return failed(e)
  }

  if (response.stop_reason === 'refusal') return json({ error: 'The AI declined to explain this opportunity.' }, 422)
  if (response.stop_reason === 'max_tokens') return json({ error: 'The AI explanation was cut short. Try again.' }, 502)

  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let parsed: { explanation: string; quotes: { label: string; text: string }[]; caveat: string }
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return failed(e)
  }

  // Keep only quotes that really appear in the attached evidence.
  const sources = evidence.map((e) => ({ label: e.label, text: normalise(e.text) }))
  const quotes = (parsed.quotes ?? []).filter((q) => q.text.trim().length > 0 && sources.some((s) => s.text.includes(normalise(q.text))))
  const dropped = (parsed.quotes ?? []).length - quotes.length

  const parts = [parsed.explanation.trim()]
  if (quotes.length) parts.push(quotes.map((q) => `“${q.text.trim()}” (${q.label})`).join('\n'))
  if (parsed.caveat?.trim()) parts.push(`Before raising it: ${parsed.caveat.trim()}`)

  return json({ explanation: parts.join('\n\n'), quotes, dropped_quotes: dropped, model: response.model })
}
