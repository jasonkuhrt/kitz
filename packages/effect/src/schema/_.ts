/**
 * `Schema` — effect's `Schema` module, extended (not shadowed) with refinement
 * schemas effect does not ship.
 *
 * Re-exports all of `effect/Schema` and adds `NaturalInt` (non-negative integer)
 * under the same namespace.
 *
 * @example
 * ```ts
 * import { Schema } from '@kitz/effect'
 *
 * Schema.String          // effect's schema
 * Schema.NaturalInt      // kitz's non-negative-integer schema
 * ```
 *
 * @module
 */
export * as Schema from './__.js'
