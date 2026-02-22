import { Option, Schema } from 'effect'
import { Custom } from './type-custom.js'
import { type BumpType, Standard, StandardImpact, StandardValue } from './type-standard.js'

// ─── Re-exports ─────────────────────────────────────────────────

export { Custom } from './type-custom.js'
export type { BumpType } from './type-standard.js'
export { Standard, StandardImpact, StandardValue } from './type-standard.js'

// ─── Type Union ─────────────────────────────────────────────────

/**
 * Commit type: either a standard type or a custom extension.
 */
export const Type = Schema.Union(Standard, Custom)
export type Type = typeof Type.Type

// ─── Parse ──────────────────────────────────────────────────────

/**
 * Type-level narrowing: returns Standard for known types, Custom otherwise.
 */
type Parse<$value extends string> = $value extends StandardValue ? Standard : Custom

/**
 * Create a Type from a raw string.
 * Known types become Standard, unknown become Custom.
 * Return type narrows based on input literal.
 */
export const parse = <$value extends string>(value: $value): Parse<$value> => {
  if (value in StandardValue.enums) {
    return Standard.make({ value: value as StandardValue }) as Parse<$value>
  }
  return Custom.make({ value }) as Parse<$value>
}

// ─── Accessors ──────────────────────────────────────────────────

/**
 * Get impact for a Standard type.
 *
 * Returns `Option.some(BumpType)` for types that trigger a release,
 * or `Option.none()` for types that don't (style, refactor, etc.)
 *
 * For Custom types, use release config lookup instead.
 */
export const impact = (type: Standard): Option.Option<BumpType> => StandardImpact[type.value]!
