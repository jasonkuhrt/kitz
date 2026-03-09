import { Schema } from 'effect'

/**
 * Represents a rule violation with error severity that causes non-zero exit (exit 1).
 */
export class Error extends Schema.TaggedClass<Error>()('SeverityError', {}) {
  static is = Schema.is(Error)
}

/**
 * Represents a rule violation with warn severity that is shown but does not affect exit status (exit 0).
 */
export class Warn extends Schema.TaggedClass<Warn>()('SeverityWarn', {}) {
  static is = Schema.is(Warn)
}

/**
 * The severity level for a rule violation.
 *
 * - `Error`: Violation causes non-zero exit (exit 1)
 * - `Warn`: Violation is shown but exit is zero (exit 0)
 */
export type Severity = Error | Warn

export const Severity = Schema.Union(Error, Warn)

export const is = Schema.is(Severity)
