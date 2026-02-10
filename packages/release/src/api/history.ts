import { Str } from '@kitz/core'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Data, Effect, Option, Schema as S } from 'effect'
import { auditPackageHistory, type AuditResult, validateAdjacent, type ValidationResult } from './lint/ops/monotonic.js'

/**
 * Options for setting a release tag.
 */
export interface SetOptions {
  /** Git commit SHA to tag */
  readonly sha: Git.Sha.Sha
  /** Full package name (e.g., '@kitz/core') */
  readonly pkg: string
  /** Semver version */
  readonly ver: Semver.Semver
  /** Auto-push tag to remote (default: true) */
  readonly push?: boolean
  /** Move existing tag if it exists at different SHA (default: false) */
  readonly move?: boolean
  /** Remote name for push (default: 'origin') */
  readonly remote?: string
}

/**
 * Result of a history set operation.
 */
export interface SetResult {
  readonly tag: string
  readonly sha: Git.Sha.Sha
  readonly version: Semver.Semver
  readonly action: 'created' | 'moved' | 'unchanged'
  readonly pushed: boolean
}

/**
 * Error for history operations.
 */
export class HistoryError extends Data.TaggedError('HistoryError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Error when a tag already exists at a different SHA.
 */
export class TagExistsError extends Data.TaggedError('TagExistsError')<{
  readonly tag: string
  readonly existingSha: string
  readonly requestedSha: string
}> {}

/**
 * Error when monotonic validation fails.
 */
export class MonotonicViolationError extends Data.TaggedError('MonotonicViolationError')<{
  readonly validation: ValidationResult
}> {}

/**
 * Set a release tag at a specific commit.
 *
 * Validates monotonic versioning before creating the tag.
 *
 * @example
 * ```ts
 * import { Semver } from '@kitz/semver'
 *
 * // Set a release tag
 * const result = await Effect.runPromise(
 *   Effect.provide(
 *     set({
 *       sha: 'abc1234',
 *       pkg: '@kitz/core',
 *       ver: Semver.fromString('1.0.0'),
 *     }),
 *     GitLive,
 *   )
 * )
 * ```
 */
export const set = (
  options: SetOptions,
): Effect.Effect<
  SetResult,
  HistoryError | TagExistsError | MonotonicViolationError | Git.GitError | Git.GitParseError,
  Git.Git
> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const moniker = Pkg.Moniker.parse(options.pkg)
    const version = options.ver
    const versionString = version.toString()
    const tag = Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: moniker, version }))
    const push = options.push ?? true
    const move = options.move ?? false
    const remote = options.remote ?? 'origin'

    // Verify SHA exists in repository
    const shaExists = yield* git.commitExists(options.sha)
    if (!shaExists) {
      return yield* Effect.fail(new HistoryError({ message: `Commit ${options.sha} does not exist in repository` }))
    }

    // Get all tags to check for conflicts and validate monotonicity
    const tags = yield* git.getTags()

    // Check if tag already exists
    const existingTagIndex = tags.indexOf(tag)
    if (existingTagIndex !== -1) {
      // Tag exists - check if it's at the same SHA
      const existingSha = yield* git.getTagSha(tag)
      if (existingSha.startsWith(options.sha) || options.sha.startsWith(existingSha)) {
        // Same SHA - idempotent, no-op
        return { tag, sha: options.sha, version, action: 'unchanged' as const, pushed: false }
      }

      // Different SHA - need --move flag
      if (!move) {
        return yield* Effect.fail(
          new TagExistsError({
            tag,
            existingSha,
            requestedSha: options.sha,
          }),
        )
      }

      // Move the tag: delete old, create new
      yield* git.deleteTag(tag)
      yield* git.deleteRemoteTag(tag, remote).pipe(Effect.ignore) // May not exist on remote
    }

    // Validate monotonic versioning (adjacent check)
    const validation = yield* validateAdjacent(options.sha, options.pkg, version, tags)
    if (!validation.valid) {
      return yield* Effect.fail(new MonotonicViolationError({ validation }))
    }

    // Create the tag
    yield* git.createTagAt(tag, options.sha, `Release ${options.pkg}@${versionString}`)

    // Push if requested
    if (push) {
      yield* git.pushTag(tag, remote, move) // Force push if moving
    }

    const action = existingTagIndex !== -1 ? 'moved' : 'created'
    return { tag, sha: options.sha, version, action, pushed: push }
  })

/**
 * Options for auditing release history.
 */
export interface AuditOptions {
  /** Specific package to audit (default: all packages) */
  readonly pkg?: string
}

/**
 * Audit release history for monotonic violations.
 *
 * @example
 * ```ts
 * // Audit all packages
 * const results = await Effect.runPromise(
 *   Effect.provide(audit(), GitLive)
 * )
 *
 * // Audit specific package
 * const result = await Effect.runPromise(
 *   Effect.provide(audit({ pkg: '@kitz/core' }), GitLive)
 * )
 * ```
 */
export const audit = (
  options: AuditOptions = {},
): Effect.Effect<AuditResult[], Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tags = yield* git.getTags()
    const decodeExactPin = S.decodeUnknownOption(Pkg.Pin.Exact.FromString)

    // Find all packages with release tags
    const packageNames = new Set<string>()
    for (const tag of tags) {
      const pin = decodeExactPin(tag)
      if (Option.isSome(pin)) {
        packageNames.add(pin.value.name.moniker)
      }
    }

    // Filter to specific package if requested
    const packagesToAudit = options.pkg
      ? [options.pkg]
      : Array.from(packageNames)

    // Audit each package
    const results: AuditResult[] = []
    for (const packageName of packagesToAudit) {
      const result = yield* auditPackageHistory(packageName, tags)
      results.push(result)
    }

    return results
  })

/**
 * Format a SetResult for display.
 */
export const formatSetResult = (result: SetResult): string => {
  const b = Str.Builder()

  switch (result.action) {
    case 'created':
      b`✓ Created tag ${result.tag} at ${result.sha.slice(0, 7)}`
      break
    case 'moved':
      b`✓ Moved tag ${result.tag} to ${result.sha.slice(0, 7)}`
      break
    case 'unchanged':
      b`○ Tag ${result.tag} already exists at ${result.sha.slice(0, 7)}`
      break
  }

  if (result.pushed) {
    b`  Pushed to remote`
  }

  return b.render()
}

/**
 * Format a TagExistsError for display.
 */
export const formatTagExistsError = (error: TagExistsError): string => {
  const b = Str.Builder()
  b`Error: Tag ${error.tag} already exists at ${error.existingSha.slice(0, 7)}`
  b``
  b`  You requested to set it at ${error.requestedSha.slice(0, 7)}.`
  b`  Use --move to relocate the tag.`
  b``
  b`  ⚠️  Moving tags may break GitHub releases if immutable releases are enabled.`
  return b.render()
}

/**
 * Format a MonotonicViolationError for display.
 */
export const formatMonotonicViolationError = (error: MonotonicViolationError): string => {
  const { validation } = error
  const b = Str.Builder()
  b`Error: Cannot set ${validation.version.toString()} at ${validation.sha.slice(0, 7)}`
  b``

  for (const violation of validation.violations) {
    b`  ${violation.message}`
  }

  b``
  b`  Hint: Versions must increase with commit order (monotonic versioning).`

  return b.render()
}

/**
 * Format AuditResult for display.
 */
export const formatAuditResult = (result: AuditResult): string => {
  const b = Str.Builder()

  b`${result.packageName}:`

  if (result.valid) {
    b`  ✓ All ${String(result.releases.length)} releases in valid order`
  } else {
    for (const violation of result.violations) {
      b`  ✗ ${violation.message}`
    }
  }

  return b.render()
}

/**
 * Format multiple AuditResults for display.
 */
export const formatAuditResults = (results: AuditResult[]): string => {
  const b = Str.Builder()

  b`Auditing release history...`
  b``

  for (const result of results) {
    b(formatAuditResult(result))
  }

  const invalidCount = results.filter((r) => !r.valid).length
  if (invalidCount > 0) {
    b``
    b`${String(invalidCount)} package(s) with violations`
  } else {
    b``
    b`All packages have valid release history`
  }

  return b.render()
}
