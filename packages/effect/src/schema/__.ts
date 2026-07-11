/**
 * `Schema` — effect's `Schema` module, extended (not shadowed) with schemas and
 * combinators effect does not ship.
 *
 * Re-exports all of `effect/Schema` and adds `NaturalInt` (non-negative integer)
 * and `withArbitraryHints` (variant schemas with biased arbitrary derivation),
 * plus `withStatics` for attaching schema-derived guards under the same namespace.
 *
 * @example
 * ```ts
 * import { Schema } from '@kitz/effect'
 *
 * Schema.String             // effect's schema
 * Schema.NaturalInt         // kitz's non-negative-integer schema
 * Schema.withArbitraryHints // kitz's arbitrary-distribution combinator
 * Schema.withStatics        // kitz's schema-static guard combinator
 * ```
 *
 * @module
 */
export * from 'effect/Schema'
export * from './NaturalInt.js'
export * from './withArbitraryHints.js'
export * from './withStatics.js'
