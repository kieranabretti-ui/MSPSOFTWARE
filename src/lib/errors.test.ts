import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, GENERIC_ERROR, mapError, NO_ACCESS, SESSION_EXPIRED } from './errors'

describe('mapError', () => {
  let spy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => spy.mockRestore())

  it('always logs the raw error', () => {
    const raw = { code: '23505', message: 'duplicate key value violates unique constraint' }
    mapError(raw, 'save')
    expect(spy).toHaveBeenCalledWith(raw)
  })

  it('explains network failures', () => {
    expect(mapError(new TypeError('Failed to fetch'), 'load')).toBe("We couldn't reach the server. Check your connection and try again. Nothing was changed.")
  })

  it('maps Postgres codes', () => {
    expect(mapError({ code: '23505' }, 'import')).toBe('Some of these rows were already imported.')
    expect(mapError({ code: '23505' }, 'save')).toBe('That already exists in this workspace.')
    expect(mapError({ code: '23503' }, 'save')).toBe('This refers to a client that no longer exists. Refresh and try again.')
    expect(mapError({ code: '23514' }, 'finding')).toBe("That change isn't allowed. Refresh the page and try again.")
    expect(mapError({ code: 'PGRST116' }, 'finding')).toBe("We couldn't find that record. It may have been removed when the analysis was re-run.")
  })

  it('maps expired sessions', () => {
    expect(mapError({ code: 'PGRST301' }, 'load')).toBe(SESSION_EXPIRED)
    expect(mapError(new AppError('x', { status: 401 }), 'load')).toBe(SESSION_EXPIRED)
    expect(mapError(new Error('JWT expired'), 'load')).toBe(SESSION_EXPIRED)
    // A signed-out caller's permission error comes back as 401.
    expect(mapError({ code: '42501', status: 401, message: 'permission denied for table clients' }, 'load')).toBe(SESSION_EXPIRED)
  })

  it('reports access refusals honestly, not as an expired session', () => {
    expect(NO_ACCESS).toBe("You don't have access to that. It may belong to another workspace, or your access may have changed. Nothing was changed.")
    expect(mapError({ code: '42501' }, 'save')).toBe(NO_ACCESS)
    expect(mapError({ code: '42501', status: 403, message: 'new row violates row-level security policy for table "tickets"' }, 'import')).toBe(NO_ACCESS)
    expect(mapError(new AppError('x', { status: 403 }), 'finding')).toBe(NO_ACCESS)
    expect(mapError(new Error('permission denied for function ai_take_quota'), 'ai')).toBe(NO_ACCESS)
  })

  it('maps upload and auth failures', () => {
    expect(mapError({ status: 413 }, 'contract')).toBe('This file is too large to upload.')
    expect(mapError(new Error('Payload too large'), 'contract')).toBe('This file is too large to upload.')
    expect(mapError(new AppError('x', { code: 'invalid_credentials' }), 'signin')).toBe('Email or password is incorrect.')
    expect(mapError(new Error('Invalid login credentials'), 'signin')).toBe('Email or password is incorrect.')
    expect(mapError(new AppError('x', { code: 'user_already_exists' }), 'signup')).toBe('An account with this email already exists. Sign in instead.')
    expect(mapError(new Error('User already registered'), 'signup')).toBe('An account with this email already exists. Sign in instead.')
    expect(mapError(new AppError('x', { code: 'weak_password' }), 'signup')).toBe('Choose a stronger password: at least 10 characters, with upper and lower case letters and a number.')
    expect(mapError({ code: 'email_not_confirmed' }, 'signin')).toBe('Confirm your email first. We sent you a link.')
    expect(mapError({ code: 'over_email_send_rate_limit' }, 'magic_link')).toBe('Too many attempts. Wait a minute and try again.')
    expect(mapError({ status: 429 }, 'signin')).toBe('Too many attempts. Wait a minute and try again.')
    expect(mapError(new AppError('x', { code: 'quota_exceeded' }), 'import')).toBe('This browser has run out of local storage. Clear data on the Analyses page or use an account.')
  })

  it("uses an AppError's own message for anything else", () => {
    expect(mapError(new AppError('Magic links need an account on the hosted service.'), 'magic_link')).toBe('Magic links need an account on the hosted service.')
  })

  it('falls back to what the user was doing', () => {
    expect(mapError(new Error('boom'), 'load')).toBe("We couldn't load your workspace. Try again.")
    expect(mapError(new Error('boom'), 'analysis')).toBe("The analysis couldn't finish. Your data is safe. Try again.")
    expect(mapError(new Error('boom'), 'import')).toBe("We couldn't import that file. Nothing was saved. Try again.")
    expect(mapError(new Error('boom'), 'contract')).toBe("We couldn't read that contract. If it's a scanned PDF, try a text-based PDF.")
    expect(mapError(new Error('boom'), 'ai')).toBe("The AI explanation couldn't be generated. Try again.")
    expect(mapError('boom', 'save')).toBe(GENERIC_ERROR)
    expect(mapError(undefined, 'report')).toBe(GENERIC_ERROR)
    expect(mapError(new AppError(GENERIC_ERROR, { code: 'XX000' }), 'load')).toBe("We couldn't load your workspace. Try again.")
  })
})
