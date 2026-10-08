// The sign-up password rule, matching supabase/config.toml (and the hosted
// Auth settings): at least 10 characters, upper and lower case letters and a number.
export const PASSWORD_HINT = 'At least 10 characters, with upper and lower case letters and a number.'
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters for your password.'
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Include both upper and lower case letters.'
  if (!/\d/.test(pw)) return 'Include at least one number.'
  return null
}
