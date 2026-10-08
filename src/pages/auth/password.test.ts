import { describe, expect, it } from 'vitest'
import { passwordProblem } from './password'

describe('sign-up password rule (matches supabase/config.toml)', () => {
  it('needs 10 characters, upper and lower case letters and a number', () => {
    expect(passwordProblem('Short1')).toMatch(/10 characters/)
    expect(passwordProblem('alllowercase1')).toMatch(/upper and lower/)
    expect(passwordProblem('ALLUPPERCASE1')).toMatch(/upper and lower/)
    expect(passwordProblem('NoNumbersHere')).toMatch(/number/)
    expect(passwordProblem('Password1234')).toBeNull()
  })
})
