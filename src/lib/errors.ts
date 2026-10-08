// Human-readable errors. Backends throw AppError with the raw code kept aside;
// screens call mapError with what the user was doing and show the result. The
// raw error always goes to the console, never to the screen.

export class AppError extends Error {
  code?: string
  status?: number
  detail?: string

  constructor(message: string, opts: { code?: string; status?: number; detail?: string } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = opts.code
    this.status = opts.status
    this.detail = opts.detail
  }
}

export type ErrorContext =
  | 'load'
  | 'save'
  | 'import'
  | 'contract'
  | 'analysis'
  | 'finding'
  | 'action'
  | 'report'
  | 'signin'
  | 'signup'
  | 'magic_link'
  | 'workspace'
  | 'settings'
  | 'demo'
  | 'ai'
  | 'signout'

const DEFAULTS: Partial<Record<ErrorContext, string>> = {
  load: "We couldn't load your workspace. Try again.",
  analysis: "The analysis couldn't finish. Your data is safe. Try again.",
  import: "We couldn't import that file. Nothing was saved. Try again.",
  contract: "We couldn't read that contract. If it's a scanned PDF, try a text-based PDF.",
  ai: "The AI explanation couldn't be generated. Try again.",
}
export const SESSION_EXPIRED = 'Your session has expired. Sign in again to continue.'
export const NO_ACCESS = "You don't have access to that. It may belong to another workspace, or your access may have changed. Nothing was changed."
export const GENERIC_ERROR = 'Something went wrong. Nothing was lost. Try again.'

// Pull a code, status and raw text out of whatever was thrown: an AppError,
// a Supabase/Postgrest error object, a fetch TypeError or a string.
function parts(e: unknown): { code: string; status: number | null; text: string } {
  if (e == null) return { code: '', status: null, text: '' }
  if (typeof e === 'string') return { code: '', status: null, text: e }
  if (typeof e !== 'object') return { code: '', status: null, text: String(e) }
  const o = e as { code?: unknown; status?: unknown; message?: unknown; detail?: unknown }
  const status = typeof o.status === 'number' ? o.status : Number.isFinite(Number(o.status)) && o.status != null ? Number(o.status) : null
  const text = [o.message, o.detail].filter((x) => typeof x === 'string').join(' ')
  return { code: o.code == null ? '' : String(o.code), status, text }
}

// The message for a known code or failure, or null when nothing specific
// applies. Context-free, so backends can use it for AppError messages.
export function knownError(e: unknown, ctx?: ErrorContext): string | null {
  const { code, status, text } = parts(e)
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(text) || code === 'network')
    return "We couldn't reach the server. Check your connection and try again. Nothing was changed."
  if (code === '23505') return ctx === 'import' ? 'Some of these rows were already imported.' : 'That already exists in this workspace.'
  if (code === '23503') return 'This refers to a client that no longer exists. Refresh and try again.'
  if (code === '23514') return "That change isn't allowed. Refresh the page and try again."
  // Signed out or expired: PostgREST answers 401 (an anonymous caller's
  // permission error included) or PGRST301.
  if (code === 'PGRST301' || status === 401 || /jwt expired/i.test(text)) return SESSION_EXPIRED
  // Signed in but not allowed: a row-level security or grant refusal. Saying
  // "session expired" here would send people round a sign-in loop and hide a
  // real authorisation failure.
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(text)) return NO_ACCESS
  if (code === 'PGRST116') return "We couldn't find that record. It may have been removed when the analysis was re-run."
  if (status === 413 || /payload too large/i.test(text)) return 'This file is too large to upload.'
  if (code === 'invalid_credentials' || /invalid login/i.test(text)) return 'Email or password is incorrect.'
  if (code === 'user_already_exists' || /already registered/i.test(text)) return 'An account with this email already exists. Sign in instead.'
  if (code === 'weak_password' || /password should (be|contain)/i.test(text)) return 'Choose a stronger password: at least 10 characters, with upper and lower case letters and a number.'
  if (code === 'email_not_confirmed') return 'Confirm your email first. We sent you a link.'
  if (code === 'over_email_send_rate_limit' || status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (code === 'quota_exceeded') return 'This browser has run out of local storage. Clear data on the Analyses page or use an account.'
  return null
}

export function mapError(e: unknown, ctx: ErrorContext): string {
  console.error(e)
  const known = knownError(e, ctx)
  if (known) return known
  // A backend's generic message gives way to what the user was doing.
  if (e instanceof AppError && e.message && e.message !== GENERIC_ERROR) return e.message
  return DEFAULTS[ctx] ?? GENERIC_ERROR
}
