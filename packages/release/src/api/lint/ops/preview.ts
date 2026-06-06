import { Effect, Layer } from 'effect'
import type { ConventionalCommitTypeImpact } from '../../config.js'
import type { Publishing } from '../../publishing.js'
import type { Lifecycle } from '../../version/models/lifecycle.js'
import type { ResolvedConfig } from '../models/config.js'
import type { Severity } from '../models/severity.js'
import * as ConventionalCommitSettings from '../services/conventional-commit-settings.js'
import { DiffService, type Diff } from '../services/diff.js'
import { DefaultGitHubLayer } from '../services/github.js'
import { type Monorepo, MonorepoService } from '../services/monorepo.js'
import { fromPullRequest, PrService } from '../services/pr.js'
import * as Preconditions from '../services/preconditions.js'
import * as ReleaseContext from '../services/release-context.js'
import * as ReleasePlan from '../services/release-plan.js'
import type { PlannedRelease } from '../services/release-plan.js'
import { check } from './check.js'
import { commandLintRule, type CommandLintRuleSpec } from './command-lint-rule.js'

/**
 * Comment-doctor lint rule table for the PR preview surface.
 *
 * Owns the rule id/order/severity set rendered into the preview comment doctor
 * section, including the conditional `pr.projected-squash-commit-sync` rule that
 * only participates when a projected squash-commit header is available.
 */
export const previewDoctorRules = (params: {
  readonly projectedHeader?: string
  readonly titleSeverity: Severity
}): readonly CommandLintRuleSpec[] =>
  [
    commandLintRule({
      id: 'env.publish-channel-ready',
      options: {
        surface: 'preview',
      },
    }),
    commandLintRule({
      id: 'plan.packages-not-private',
    }),
    commandLintRule({
      id: 'plan.packages-license-present',
    }),
    commandLintRule({
      id: 'plan.packages-repository-present',
    }),
    commandLintRule({
      id: 'plan.packages-repository-match-canonical',
    }),
    commandLintRule({
      id: 'plan.versions-unpublished',
    }),
    commandLintRule({
      id: 'plan.tags-unique',
    }),
    commandLintRule({
      id: 'pr.type.release-kind-match-diff',
      severity: params.titleSeverity,
    }),
    ...(params.projectedHeader
      ? [
          commandLintRule({
            id: 'pr.projected-squash-commit-sync',
            options: {
              projectedHeader: params.projectedHeader,
            },
            severity: params.titleSeverity,
          }),
        ]
      : []),
  ] satisfies readonly CommandLintRuleSpec[]

/**
 * Run the lint check for the PR preview surface.
 *
 * Owns the full Effect layer wiring around {@link check}: provides the diff,
 * GitHub access, preconditions, release plan, release context, and conventional
 * commit settings services plus the per-PR monorepo and PR services.
 */
export const checkForPreview = (params: {
  readonly config: ResolvedConfig
  readonly diff: Diff
  readonly packageCount: number
  readonly monorepo: Monorepo
  readonly releasePlan: readonly PlannedRelease[]
  readonly lifecycle: Lifecycle | null
  readonly publishing: Publishing
  readonly resolvedConventionalCommitTypes: Record<string, ConventionalCommitTypeImpact>
  readonly pullRequest: {
    readonly number: number
    readonly title: string
    readonly body: string | null
  }
}) =>
  Effect.gen(function* () {
    return yield* check({ config: params.config }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(DiffService, params.diff),
          DefaultGitHubLayer,
          Preconditions.make({
            hasOpenPR: true,
            hasDiff: params.diff.files.length > 0,
            hasReleasePlan: true,
            isMonorepo: params.packageCount > 1,
          }),
          ReleasePlan.make(params.releasePlan),
          ReleaseContext.make({
            lifecycle: params.lifecycle,
            publishing: params.publishing,
          }),
          ConventionalCommitSettings.make({
            resolvedTypes: params.resolvedConventionalCommitTypes,
          }),
        ),
      ),
      Effect.provideService(MonorepoService, params.monorepo),
      Effect.provideService(PrService, yield* fromPullRequest(params.pullRequest)),
    )
  })
