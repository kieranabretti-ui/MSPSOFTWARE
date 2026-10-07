import { describe, expect, it } from 'vitest'
import { mightHaveSession } from './lazySupabase'

// The landing page must not download supabase-js for a visitor who has never
// signed in, but must still pick up a stored session or a sign-in link.
describe('mightHaveSession', () => {
  it('is false for a fresh visitor', () => {
    expect(mightHaveSession([], '', '')).toBe(false)
    expect(mightHaveSession(['headroom:mode', 'theme'], '#pricing', '?intent=audit')).toBe(false)
  })

  it('is true with a stored Supabase auth token', () => {
    expect(mightHaveSession(['sb-abcdefgh-auth-token'], '', '')).toBe(true)
  })

  it('is true when a magic link or confirmation lands with tokens', () => {
    expect(mightHaveSession([], '#access_token=x&refresh_token=y&type=magiclink', '')).toBe(true)
    expect(mightHaveSession([], '#error_description=Email+link+is+invalid', '')).toBe(true)
    expect(mightHaveSession([], '', '?code=abc')).toBe(true)
  })
})
