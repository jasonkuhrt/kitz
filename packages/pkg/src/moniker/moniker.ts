import { SchemaGetter, Schema as S } from 'effect'

// ============================================================================
// Scoped Package
// ============================================================================

/**
 * Scoped package name (e.g., "\@kitz/core").
 */
export class Scoped extends S.TaggedClass<Scoped>()('Scoped', {
  scope: S.String,
  name: S.String,
}) {
  static make = this.makeUnsafe
  static is = S.is(Scoped)

  /**
   * Full package name string (e.g., "\@kitz/core").
   */
  get moniker(): string {
    return `@${this.scope}/${this.name}`
  }

  /**
   * URL-encoded form for npm registry requests.
   */
  get encoded(): string {
    return `@${this.scope}%2f${this.name}`
  }
}

/**
 * Schema that parses "\@scope/name" strings into Scoped instances.
 */
export const ScopedFromString: S.Codec<Scoped, string> = S.String.pipe(
  S.check(S.isPattern(/^@[^/]+\/.+$/)),
).pipe(
  S.decodeTo(Scoped, {
    decode: SchemaGetter.transform((s) => {
      const match = s.match(/^@([^/]+)\/(.+)$/)!
      return new Scoped({ scope: match[1]!, name: match[2]! })
    }),
    encode: SchemaGetter.transform((scoped) => `@${scoped.scope}/${scoped.name}`),
  }),
)

// ============================================================================
// Unscoped Package
// ============================================================================

/**
 * Unscoped package name (e.g., "lodash").
 */
export class Unscoped extends S.TaggedClass<Unscoped>()('Unscoped', {
  name: S.String,
}) {
  static make = this.makeUnsafe
  static is = S.is(Unscoped)

  /**
   * Full package name string.
   */
  get moniker(): string {
    return this.name
  }

  /**
   * URL-encoded form for npm registry requests.
   */
  get encoded(): string {
    return encodeURIComponent(this.name)
  }
}

/**
 * Schema that parses unscoped package name strings into Unscoped instances.
 */
export const UnscopedFromString: S.Codec<Unscoped, string> = S.String.pipe(
  S.check(S.isPattern(/^[^@/][^/]*$/)),
).pipe(
  S.decodeTo(Unscoped, {
    decode: SchemaGetter.transform((s) => new Unscoped({ name: s })),
    encode: SchemaGetter.transform((unscoped) => unscoped.name),
  }),
)

// ============================================================================
// Package Moniker (Union)
// ============================================================================

/**
 * Package moniker - either scoped (\@scope/name) or unscoped (name).
 */
export type Moniker = Scoped | Unscoped

/**
 * Schema that parses package name strings into Moniker instances.
 *
 * @example
 * ```ts
 * import { Pkg } from '@kitz/pkg'
 * import { Schema } from 'effect'
 *
 * const scoped = Schema.decodeSync(Pkg.Moniker.FromString)('@kitz/core')
 * // Scoped { scope: 'kitz', name: 'core' }
 *
 * const unscoped = Schema.decodeSync(Pkg.Moniker.FromString)('lodash')
 * // Unscoped { name: 'lodash' }
 * ```
 */
export const FromString: S.Codec<Moniker, string> = S.Union([ScopedFromString, UnscopedFromString])

/**
 * Decode a package name string into a Moniker, throwing on invalid input.
 */
export const parse = S.decodeSync(FromString)

/**
 * Check if a moniker is scoped.
 */
export const isScoped = (moniker: Moniker): moniker is Scoped => Scoped.is(moniker)

/**
 * Check if a moniker is unscoped.
 */
export const isUnscoped = (moniker: Moniker): moniker is Unscoped => Unscoped.is(moniker)
