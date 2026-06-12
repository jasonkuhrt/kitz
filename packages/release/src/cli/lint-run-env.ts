/**
 * @module cli/lint-run-env
 *
 * Shared environment assembly for running `Lint.check` from CLI commands.
 *
 * Both lint-running surfaces (the doctor report and the PR preview doctor
 * summary) need the same service stack: diff, GitHub, preconditions, release
 * plan, release context, conventional-commit settings, monorepo shape, and PR
 * context. This module owns that assembly so the two surfaces cannot drift.
 */
import { Github } from '@kitz/github'
import { Effect, Layer, Option } from 'effect'
import type { Package } from '../api/analyzer/workspace.js'
import * as Config from '../api/config.js'
import * as Lint from '../api/lint/__.js'
import * as Planner from '../api/planner/__.js'

/** Project the workspace packages into the lint monorepo service shape. */
export const toMonorepo = (packages: readonly Package[]) => ({
  packages: packages.map((pkg) => ({
    name: pkg.name.moniker,
    path: pkg.path.toString(),
  })),
  validScopes: packages.map((pkg) => pkg.scope),
})

const emptyPrContext = {
  number: 0,
  title: '',
  body: '',
  commit: Option.none(),
  titleParseError: Option.none(),
} as const

export interface LintRunEnvParams {
  readonly config: Config.ResolvedConfig
  readonly plan: Planner.Plan
  readonly packages: readonly Package[]
  readonly diff: Lint.Diff | null
  readonly pullRequest: Github.PullRequest | null
  /**
   * Branch-gating context for `env.release-branch-allowed`.
   *
   * Execution-facing surfaces (doctor) pass the configured trunk and current
   * branch so official/candidate plans are gated to trunk. The PR preview
   * surface deliberately omits this: it always evaluates an ephemeral plan on
   * a PR branch, where trunk gating is meaningless.
   */
  readonly branchContext?: {
    readonly trunk: string
    readonly currentBranch: string
  }
}

/**
 * Provide the full lint-run service stack to an effect (typically
 * `Lint.check`). Returns a pipeable combinator.
 */
export const provideLintRunEnv =
  (params: LintRunEnvParams) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const plannedItems = [...params.plan.releases, ...params.plan.cascades]
      const prContext = params.pullRequest
        ? yield* Lint.fromPullRequest(params.pullRequest)
        : emptyPrContext
      const diffLayer = params.diff
        ? Layer.succeed(Lint.DiffService, params.diff)
        : Lint.DefaultDiffLayer
      const hasDiff = params.diff !== null && params.diff.files.length > 0

      return yield* effect.pipe(
        Effect.provide(
          Layer.mergeAll(
            diffLayer,
            Lint.DefaultGitHubLayer,
            Lint.Preconditions.make({
              hasOpenPR: params.pullRequest !== null,
              hasDiff,
              hasReleasePlan: true,
              isMonorepo: params.packages.length > 1,
            }),
            Lint.ReleasePlan.make(
              plannedItems.map((item) => ({
                packageName: item.package.name,
                packagePath: item.package.path,
                version: item.nextVersion,
              })),
            ),
            Lint.ReleaseContext.make({
              lifecycle: params.plan.lifecycle,
              publishing: params.config.publishing,
              ...(params.branchContext ?? {}),
            }),
            Lint.ConventionalCommitSettings.make({
              resolvedTypes: params.config.resolvedConventionalCommitTypes,
            }),
          ),
        ),
        Effect.provideService(Lint.MonorepoService, toMonorepo(params.packages)),
        Effect.provideService(Lint.PrService, prContext),
      )
    })
