import { Schema } from 'effect'

/**
 * The severity level for a rule violation.
 *
 * - `'error'`: violation causes non-zero exit (exit 1)
 * - `'warn'`: violation is shown but exit is zero (exit 0)
 */
export const Severity = Schema.Literals(['error', 'warn'])
export type Severity = typeof Severity.Type

export const is = Schema.is(Severity)
