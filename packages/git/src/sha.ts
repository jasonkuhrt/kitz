import { Schema } from 'effect'

/**
 * Git commit SHA (short or full form).
 *
 * - Short form: 7-12 hex characters (default `git log --oneline` output)
 * - Full form: 40 hex characters (complete SHA-1 hash)
 *
 * @example
 * ```ts
 * import { Git } from '@kitz/git'
 *
 * const sha = Git.Sha.make('abc1234')
 * const full = Git.Sha.make('abc1234567890abcdef1234567890abcdef123456')
 * ```
 */
export const Sha = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{7,40}$/i),
  Schema.brand('Sha'),
  Schema.annotations({
    identifier: 'Sha',
    title: 'Git SHA',
    description: 'A git commit SHA in short (7-12 chars) or full (40 chars) form',
  }),
)

export type Sha = typeof Sha.Type

/** Create a SHA from a string, throwing on invalid input. */
export const make = Schema.decodeSync(Sha)

/** Check if a value is a valid SHA. */
export const is = Schema.is(Sha)
