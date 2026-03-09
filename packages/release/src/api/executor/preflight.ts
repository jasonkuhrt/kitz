import { CommandExecutor, FileSystem } from '@effect/platform'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect, Layer, Option, Schema as S } from 'effect'
import { defaultPublishing, resolvePublishChannel, type Publishing } from '../publishing.js'
import * as Lint from '../lint/__.js'
import { Finished } from '../lint/models/report.js'
import type { ReleaseInfo } from './publish.js'

const baseTags = ['kit', 'release', 'preflight'] as const
const NpmAuthMetadataSchema = S.Struct({ username: S.String })
const GitRemoteMetadataSchema = S.Struct({ url: S.String })
const PreflightErrorContext = S.Struct({
  check: S.String,
  detail: S.String,
})
const decodeNpmAuthMetadata = S.decodeUnknownOption(NpmAuthMetadataSchema)
const decodeGitRemoteMetadata = S.decodeUnknownOption(GitRemoteMetadataSchema)

/**
 * Error during preflight checks.
 */
export const PreflightError: Err.TaggedContextualErrorClass<
  'PreflightError',
  typeof baseTags,
  typeof PreflightErrorContext,
  undefined
> = Err.TaggedContextualError('PreflightError', baseTags, {
  context: PreflightErrorContext,
  message: (ctx) =>
    `Preflight check '${ctx.check}' failed: ${ctx.detail}\n` +
    `  Run 'release doctor --onlyRule "${ctx.check}"' to investigate.`,
})

export type PreflightError = InstanceType<typeof PreflightError>

/**
 * Result of preflight checks.
 */
export interface PreflightResult {
  readonly npmUser: string
  readonly gitRemote: string
}

/**
 * Options for preflight checks.
 */
export interface PreflightOptions {
  /** npm registry URL */
  readonly registry?: string
  /** git remote name (default: 'origin') */
  readonly remote?: string
  /** Skip npm auth check (e.g., for dry run) */
  readonly skipNpmAuth?: boolean
  /** Skip git clean check */
  readonly skipGitClean?: boolean
  /** Active lifecycle when preflighting a concrete plan. */
  readonly lifecycle?: 'official' | 'candidate' | 'ephemeral'
  /** Declared release publishing system. */
  readonly publishing?: Publishing
  /** Configured trunk branch for branch-policy checks. */
  readonly trunk?: string
}

/**
 * Run all preflight checks using the lint system.
 *
 * Validates that the environment is ready for a release:
 * - the declared publish channel is usable in this runtime (env.publish-channel-ready)
 * - npm authentication works (env.npm-authenticated)
 * - git working directory is clean (env.git-clean)
 * - git remote is reachable (env.git-remote)
 * - planned tags don't already exist (plan.tags-unique)
 * - planned package versions are not already published (plan.versions-unpublished)
 * - planned package manifests are publishable (plan.packages-*)
 */
export const run = (
  releases: ReleaseInfo[],
  options?: PreflightOptions,
): Effect.Effect<
  PreflightResult,
  PreflightError,
  Env.Env | Git.Git | CommandExecutor.CommandExecutor | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    yield* Effect.log('Running preflight checks...')
    const git = yield* Git.Git

    // Build skip rules based on options
    const skipRules: string[] = []
    if (options?.skipNpmAuth) skipRules.push('env.npm-authenticated')
    if (options?.skipGitClean) skipRules.push('env.git-clean')
    if (options?.lifecycle) {
      const channel = resolvePublishChannel(
        options?.publishing ?? defaultPublishing(),
        options.lifecycle,
      )
      if (channel.mode === 'github-trusted') {
        skipRules.push('env.npm-authenticated')
      }
    }

    // Configure lint to run preflight-related rules
    const config = Lint.resolveConfig({
      onlyRules: ['env.*', 'plan.*'],
      skipRules: skipRules.length > 0 ? skipRules : undefined,
      rules: {
        'env.npm-authenticated': Lint.RuleConfig.make({
          overrides: Lint.RuleDefaults.make({ enabled: true }),
          options: {
            ...(options?.registry && { registry: options.registry }),
          },
        }),
        'env.git-clean': Lint.RuleConfig.make({
          overrides: Lint.RuleDefaults.make({ enabled: true }),
          options: {},
        }),
        'env.git-remote': Lint.RuleConfig.make({
          overrides: Lint.RuleDefaults.make({ enabled: true }),
          options: { remote: options?.remote ?? 'origin' },
        }),
        'plan.tags-unique': Lint.RuleConfig.make({
          overrides: Lint.RuleDefaults.make({ enabled: true }),
          options: {},
        }),
        'plan.versions-unpublished': Lint.RuleConfig.make({
          overrides: Lint.RuleDefaults.make({ enabled: true }),
          options: {},
        }),
      },
    })

    // Prepare layers for lint
    const plannedReleases = releases.map((r) => ({
      packageName: r.package.name,
      packagePath: r.package.path,
      version: r.nextVersion,
    }))
    const currentBranch = yield* git.getCurrentBranch().pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new PreflightError({
            context: {
              check: 'env.release-branch-allowed',
              detail: error.message ?? String(error),
            },
          }),
        ),
      ),
    )

    const preconditionsLayer = Lint.Preconditions.make({
      hasReleasePlan: plannedReleases.length > 0,
    })

    const releasePlanLayer = Lint.ReleasePlan.make(plannedReleases)
    const releaseContextLayer = Lint.ReleaseContext.make({
      lifecycle: options?.lifecycle ?? null,
      publishing: options?.publishing ?? defaultPublishing(),
      trunk: options?.trunk ?? null,
      currentBranch,
    })

    // Run lint check, mapping any errors to PreflightError
    const report = yield* Lint.check({ config }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Lint.DefaultServicesLayer,
          preconditionsLayer,
          releasePlanLayer,
          releaseContextLayer,
        ),
      ),
      Effect.catchAll((error) =>
        Effect.fail(
          new PreflightError({
            context: {
              check: 'lint-execution',
              detail: error.message ?? String(error),
            },
          }),
        ),
      ),
    )

    // Extract metadata and check for violations
    let npmUser = '(unknown)'
    let gitRemote = '(unknown)'
    const violations: Array<{ ruleId: string; message: string }> = []

    for (const result of report.results) {
      if (!Finished.is(result)) continue

      // Extract metadata from successful checks
      if (result.rule.id === 'env.npm-authenticated' && result.metadata) {
        npmUser = decodeNpmAuthMetadata(result.metadata).pipe(
          Option.map((metadata) => metadata.username),
          Option.getOrElse(() => npmUser),
        )
      }
      if (result.rule.id === 'env.git-remote' && result.metadata) {
        gitRemote = decodeGitRemoteMetadata(result.metadata).pipe(
          Option.map((metadata) => metadata.url),
          Option.getOrElse(() => gitRemote),
        )
      }

      // Collect violations
      if (result.violation && Lint.Error.is(result.severity)) {
        const message =
          result.violation.location._tag === 'ViolationLocationEnvironment'
            ? result.violation.location.message
            : 'Check failed'
        violations.push({ ruleId: result.rule.id, message })
      }
    }

    // Fail if any violations
    if (violations.length > 0) {
      const first = violations[0]!
      return yield* Effect.fail(
        new PreflightError({
          context: {
            check: first.ruleId,
            detail: first.message,
          },
        }),
      )
    }

    yield* Effect.log('All preflight checks passed')

    return {
      npmUser,
      gitRemote,
    }
  })
