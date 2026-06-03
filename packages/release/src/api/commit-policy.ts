/**
 * @module api/commit-policy
 *
 * Single source of truth for this repo's conventional-commit *policy*: which
 * commit types are recognized (Angular standard or config-declared) and what
 * counts as a valid commit title.
 *
 * Grammar — what a valid title or type *looks like* — is owned by
 * `@kitz/conventional-commits`. This module owns the opinionated layer on top:
 * the set of *allowed* types resolved from release config. Every consumer that
 * needs the policy (the `pr.type.match-known` and `commit.type.match-known`
 * lint rules, and the `release git commit validate` CLI command) composes these
 * primitives rather than re-deriving the rule.
 */
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Result } from 'effect'

/**
 * Resolved type→impact catalog. Only the key set matters for recognition, so
 * the value type is widened to `unknown`.
 */
type ResolvedTypes = Readonly<Record<string, unknown>>

/**
 * A commit type is recognized when it is an Angular standard type or has been
 * declared in `conventionalCommitSettings.types` (release config).
 */
export const isKnownType = (
  type: ConventionalCommits.Type.Type,
  resolvedTypes: ResolvedTypes,
): boolean => ConventionalCommits.Type.Standard.is(type) || type.value in resolvedTypes

/**
 * The types in `commit` that the policy does not recognize, in first-seen
 * order. Empty when every type is known.
 */
export const findUnknownTypes = (
  commit: ConventionalCommits.Commit.Commit,
  resolvedTypes: ResolvedTypes,
): readonly ConventionalCommits.Type.Type[] =>
  ConventionalCommits.Commit.types(commit).filter((type) => !isKnownType(type, resolvedTypes))

/** The title failed to parse as a conventional-commit title. */
export interface InvalidTitle {
  readonly _tag: 'InvalidTitle'
  readonly reason: string
  readonly input: string
}

/** The title parsed, but one or more of its types are not recognized. */
export interface UnknownTypes {
  readonly _tag: 'UnknownTypes'
  readonly types: readonly string[]
}

/** A single commit-policy diagnostic. */
export type Problem = InvalidTitle | UnknownTypes

/**
 * Validate a commit *title* (the subject line) against the policy.
 *
 * Returns diagnostics in evaluation order; an empty array means the title is
 * valid. A title that fails to parse yields a single {@link InvalidTitle}; an
 * otherwise-valid title carrying unrecognized types yields a single
 * {@link UnknownTypes}.
 */
export const validateTitle = (
  subject: string,
  resolvedTypes: ResolvedTypes,
): readonly Problem[] => {
  const parsed = ConventionalCommits.Title.parseEither(subject)
  if (Result.isFailure(parsed)) {
    return [{ _tag: 'InvalidTitle', reason: parsed.failure.context.reason, input: subject }]
  }
  const unknown = findUnknownTypes(parsed.success, resolvedTypes)
  if (unknown.length > 0) {
    return [{ _tag: 'UnknownTypes', types: unknown.map((type) => type.value) }]
  }
  return []
}
