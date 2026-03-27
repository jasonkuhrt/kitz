import { Schema } from 'effect'

/**
 * Represents a rule violation with error severity that causes non-zero exit (exit 1).
 */
export class Error extends Schema.TaggedClass<Error>()('SeverityError', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Error)
  static decode = Schema.decodeUnknownEffect(Error)
  static decodeSync = Schema.decodeUnknownSync(Error)
  static encode = Schema.encodeUnknownEffect(Error)
  static encodeSync = Schema.encodeUnknownSync(Error)
  static equivalence = Schema.toEquivalence(Error)
  static ordered = false as const
}

/**
 * Represents a rule violation with warn severity that is shown but does not affect exit status (exit 0).
 */
export class Warn extends Schema.TaggedClass<Warn>()('SeverityWarn', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Warn)
  static decode = Schema.decodeUnknownEffect(Warn)
  static decodeSync = Schema.decodeUnknownSync(Warn)
  static encode = Schema.encodeUnknownEffect(Warn)
  static encodeSync = Schema.encodeUnknownSync(Warn)
  static equivalence = Schema.toEquivalence(Warn)
  static ordered = false as const
}

/**
 * The severity level for a rule violation.
 *
 * - `Error`: Violation causes non-zero exit (exit 1)
 * - `Warn`: Violation is shown but exit is zero (exit 0)
 */
export type Severity = Error | Warn

export const Severity = Schema.Union([Error, Warn]).pipe(Schema.toTaggedUnion('_tag'))

export namespace Severity {
  export type Error = import('./severity.js').Error
  export type Warn = import('./severity.js').Warn
}

export const is = Schema.is(Severity)
