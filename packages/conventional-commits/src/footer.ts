import { Schema } from 'effect'

// ─── Standard Token ────────────────────────────────────────────

/**
 * Standard footer tokens defined by the Conventional Commits spec.
 * Both forms are semantically equivalent per the spec.
 */
export const StandardToken = Schema.Enums({
  'BREAKING CHANGE': 'BREAKING CHANGE',
  'BREAKING-CHANGE': 'BREAKING-CHANGE',
})
export type StandardToken = typeof StandardToken.Type

// ─── Standard Footer ───────────────────────────────────────────

/**
 * A standard footer with a spec-defined token (e.g., BREAKING CHANGE).
 */
export class Standard extends Schema.TaggedClass<Standard>()('Standard', {
  token: StandardToken,
  value: Schema.String,
}) {
  static is = Schema.is(Standard)
}

// ─── Custom Footer ─────────────────────────────────────────────

/**
 * A custom footer with a user-defined token (e.g., Fixes, Closes, Reviewed-by).
 */
export class Custom extends Schema.TaggedClass<Custom>()('Custom', {
  token: Schema.String,
  value: Schema.String,
}) {
  static is = Schema.is(Custom)
}

// ─── Footer Union ──────────────────────────────────────────────

/**
 * Footer: either a standard spec-defined footer or a custom extension.
 */
export const Footer = Schema.Union(Standard, Custom)
export type Footer = typeof Footer.Type

// ─── Accessors ─────────────────────────────────────────────────

/**
 * Extract the token from any Footer.
 */
export const token = (footer: Footer): string => footer.token

/**
 * Extract the value from any Footer.
 */
export const value = (footer: Footer): string => footer.value

/**
 * Check if a footer indicates a breaking change.
 * Standard footers are always breaking changes (that's what they represent).
 */
export const isBreakingChange = (footer: Footer): boolean => Standard.is(footer)

// ─── Smart Constructor ─────────────────────────────────────────

/**
 * Type-level narrowing: returns Standard for known tokens, Custom otherwise.
 */
type From<$token extends string> = $token extends StandardToken ? Standard : Custom

/**
 * Create a Footer from a token and value.
 * Known tokens become Standard, unknown become Custom.
 */
export const from = <$token extends string>(token: $token, value: string): From<$token> => {
  if (token in StandardToken.enums) {
    return new Standard({ token: token as StandardToken, value }) as From<$token>
  }
  return new Custom({ token, value }) as From<$token>
}
