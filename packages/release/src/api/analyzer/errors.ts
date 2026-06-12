import { Err } from '@kitz/core'
import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'release'] as const

// ── History ──────────────────────────────────────────────────────────

const HistoryErrorContext = S.Struct({
  /** What went wrong, in operator-readable terms. */
  detail: S.String,
})

/**
 * Raised when a history operation cannot proceed (e.g. tagging a commit
 * that does not exist in the repository).
 */
export const HistoryError: Err.TaggedContextualErrorClass<
  'HistoryError',
  typeof baseTags,
  typeof HistoryErrorContext,
  undefined
> = Err.TaggedContextualError('HistoryError', baseTags, {
  context: HistoryErrorContext,
  message: (ctx) => ctx.detail,
})

export type HistoryError = InstanceType<typeof HistoryError>

const TagExistsErrorContext = S.Struct({
  /** The release tag that already exists. */
  tag: S.String,
  /** SHA the existing tag points at. */
  existingSha: S.String,
  /** SHA the caller asked to tag. */
  requestedSha: S.String,
})

/**
 * Raised when a release tag already exists at a different SHA and `move`
 * was not requested.
 */
export const TagExistsError: Err.TaggedContextualErrorClass<
  'TagExistsError',
  typeof baseTags,
  typeof TagExistsErrorContext,
  undefined
> = Err.TaggedContextualError('TagExistsError', baseTags, {
  context: TagExistsErrorContext,
  message: (ctx) =>
    `Tag ${ctx.tag} already exists at ${ctx.existingSha.slice(0, 7)}; requested ${ctx.requestedSha.slice(0, 7)}`,
})

export type TagExistsError = InstanceType<typeof TagExistsError>

const MonotonicViolationSchema = S.Struct({
  existingVersion: Semver.Semver,
  existingSha: Git.Sha.Sha,
  relationship: S.Literals(['ancestor', 'descendant']),
  message: S.String,
})

const ValidationResultSchema = S.Struct({
  valid: S.Boolean,
  version: Semver.Semver,
  sha: Git.Sha.Sha,
  violations: S.Array(MonotonicViolationSchema),
})

const MonotonicViolationErrorContext = S.Struct({
  /** The failed monotonic validation, including every violation found. */
  validation: ValidationResultSchema,
})

/**
 * Raised when setting a release tag would violate monotonic versioning
 * (versions must increase with commit order).
 */
export const MonotonicViolationError: Err.TaggedContextualErrorClass<
  'MonotonicViolationError',
  typeof baseTags,
  typeof MonotonicViolationErrorContext,
  undefined
> = Err.TaggedContextualError('MonotonicViolationError', baseTags, {
  context: MonotonicViolationErrorContext,
  message: (ctx) =>
    `Cannot set ${Semver.toString(ctx.validation.version)} at ${ctx.validation.sha.slice(0, 7)}: ` +
    `${String(ctx.validation.violations.length)} monotonic violation(s)`,
})

export type MonotonicViolationError = InstanceType<typeof MonotonicViolationError>

// ── Workspace ────────────────────────────────────────────────────────

const PackageResolutionErrorContext = S.Struct({
  /** What went wrong, in operator-readable terms. */
  detail: S.String,
  /** The configured scope being resolved. */
  scope: S.String,
  /** The configured package name being resolved. */
  packageName: S.String,
})

/**
 * Raised when a configured package cannot be resolved against workspace
 * discovery or its configured path.
 */
export const PackageResolutionError: Err.TaggedContextualErrorClass<
  'PackageResolutionError',
  typeof baseTags,
  typeof PackageResolutionErrorContext,
  undefined
> = Err.TaggedContextualError('PackageResolutionError', baseTags, {
  context: PackageResolutionErrorContext,
  message: (ctx) => ctx.detail,
})

export type PackageResolutionError = InstanceType<typeof PackageResolutionError>

// ── Package location ─────────────────────────────────────────────────

const PackageLocationErrorContext = S.Struct({
  /** Repo root the path was resolved against (normalized, no trailing slash). */
  root: S.String,
  /** The offending package path (normalized, no trailing slash). */
  path: S.String,
  problem: S.Literals(['outside-root', 'is-root']),
})

/**
 * Raised when a package path cannot be expressed relative to the repo root.
 */
export const PackageLocationError: Err.TaggedContextualErrorClass<
  'PackageLocationError',
  typeof baseTags,
  typeof PackageLocationErrorContext,
  undefined
> = Err.TaggedContextualError('PackageLocationError', baseTags, {
  context: PackageLocationErrorContext,
  message: (ctx) =>
    ctx.problem === 'outside-root'
      ? `Package path "${ctx.path}/" is not inside repo root "${ctx.root}/".`
      : `Package path "${ctx.path}/" cannot be the repo root itself.`,
})

export type PackageLocationError = InstanceType<typeof PackageLocationError>

/** Union of all analyzer errors. */
export type All =
  | HistoryError
  | TagExistsError
  | MonotonicViolationError
  | PackageResolutionError
  | PackageLocationError
