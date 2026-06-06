import { Env } from '@kitz/env'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import type { Semver } from '@kitz/semver'
import { Effect, Layer, Result, Option } from 'effect'
import * as Analyzer from './analyzer/__.js'
import type { Analysis } from './analyzer/models/analysis.js'
import type { ResolvedConfig } from './config.js'
import * as Explorer from './explorer/__.js'

export interface ScopeImpact {
  readonly scope: string
  readonly bump: Semver.BumpType
}

export interface Preview {
  readonly actualTitle: string
  readonly actualHeader: string | null
  readonly actualTitleError: string | null
  readonly projectedHeader: string | null
  readonly inSync: boolean
  readonly reason: string | null
}

export const collectScopeImpacts = (
  analysis: Pick<Analysis, 'impacts'>,
  options?: {
    readonly scopes?: readonly string[]
    /**
     * When true, exclude patch-only scopes if feat-level (minor/major) scopes exist.
     * This produces a focused title that reflects the PR's primary intent rather than
     * listing every collateral fix.
     */
    readonly primaryOnly?: boolean
  },
): readonly ScopeImpact[] => {
  const allowedScopes = options?.scopes ?? null
  const impacts = analysis.impacts
    .filter((impact) => (allowedScopes ? allowedScopes.includes(impact.package.scope) : true))
    .map((impact) => ({
      scope: impact.package.scope,
      bump: impact.bump,
    }))

  const allScopeImpacts = normalizeScopes(impacts.map((impact) => impact.scope)).map((scope) => {
    const scopedImpacts = impacts.filter((impact) => impact.scope === scope)
    const bump = scopedImpacts.some((impact) => impact.bump === 'major')
      ? 'major'
      : scopedImpacts.some((impact) => impact.bump === 'minor')
        ? 'minor'
        : 'patch'
    return { scope, bump } satisfies ScopeImpact
  })

  if (options?.primaryOnly) {
    const hasFeatLevel = allScopeImpacts.some((si) => si.bump === 'minor' || si.bump === 'major')
    if (hasFeatLevel) {
      return allScopeImpacts.filter((si) => si.bump === 'minor' || si.bump === 'major')
    }
  }

  return allScopeImpacts
}

const normalizeScopes = (scopes: readonly string[]): readonly string[] =>
  scopes
    .filter((scope, index) => scopes.indexOf(scope) === index)
    .toSorted((left, right) => left.localeCompare(right))

const orderByBump: Readonly<Record<Semver.BumpType, number>> = {
  major: 0,
  minor: 1,
  patch: 2,
}

const targetForImpact = (impact: ScopeImpact): ConventionalCommits.Target =>
  ConventionalCommits.Target.make({
    type: ConventionalCommits.Type.parse(impact.bump === 'patch' ? 'fix' : 'feat'),
    scope: impact.scope,
    breaking: impact.bump === 'major',
  })

export const renderHeader = (params: {
  readonly impacts: readonly ScopeImpact[]
}): string | null => {
  if (params.impacts.length === 0) return null

  const commit = ConventionalCommits.Commit.Multi.make({
    targets: params.impacts
      .toSorted(
        (left, right) =>
          orderByBump[left.bump] - orderByBump[right.bump] || left.scope.localeCompare(right.scope),
      )
      .map(targetForImpact) as [ConventionalCommits.Target, ...ConventionalCommits.Target[]],
    message: 'projected release header',
    summary: Option.none(),
    sections: {},
  })

  return ConventionalCommits.Commit.renderHeader(commit)
}

const getActualHeader = (
  title: string,
): {
  readonly header: string | null
  readonly error: string | null
} => {
  const parsed = ConventionalCommits.Title.parseEither(title.trim())

  if (Result.isFailure(parsed)) {
    return {
      header: null,
      error: parsed.failure.message,
    }
  }

  return {
    header: ConventionalCommits.Commit.renderHeader(parsed.success),
    error: null,
  }
}

export const preview = (params: {
  readonly actualTitle: string
  readonly impacts: readonly ScopeImpact[]
}): Preview => {
  const actualTitle = params.actualTitle.trim()
  const actual = getActualHeader(actualTitle)
  const projectedHeader = renderHeader({
    impacts: params.impacts,
  })

  if (projectedHeader === null) {
    return {
      actualTitle,
      actualHeader: actual.header,
      actualTitleError: actual.error,
      projectedHeader: null,
      inSync: actualTitle.length === 0,
      reason: 'No primary release impacts were found.',
    }
  }

  return {
    actualTitle,
    actualHeader: actual.header,
    actualTitleError: actual.error,
    projectedHeader,
    inSync: actual.header === projectedHeader,
    reason: null,
  }
}

/**
 * Resolve the connected pull request and project the canonical release-header
 * title for it. Returns `null` when the workspace has no packages (a graceful
 * no-op the caller reports), fails with an {@link Explorer.ExplorerError} when
 * no open PR is connected or no primary release impacts exist, and otherwise
 * returns the projected header plus the suggested rewritten title (or the
 * rewrite error). `diffRemote` is supplied by the caller so this op stays free
 * of CLI diff-remote resolution.
 */
export const suggestPrTitle = (params: {
  readonly config: ResolvedConfig
  readonly diffRemote: string
}) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const packages = yield* Analyzer.Workspace.resolvePackages(params.config.packages)

    if (packages.length === 0) return null

    const githubContext = yield* Explorer.resolvePullRequestContext()
    const pullRequest = githubContext.pullRequest
    if (!pullRequest) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail:
              'Could not resolve an open pull request for the current branch. Set PR_NUMBER explicitly or open a PR first.',
          },
        }),
      )
    }

    const tags = yield* git.getTags()
    const analysis = yield* Analyzer.analyze({
      packages,
      tags,
      since: `${params.diffRemote}/${pullRequest.base.ref}`,
      resolvedConventionalCommitTypes: params.config.resolvedConventionalCommitTypes,
      commitOverrides: params.config.commitOverrides,
    })
    const projectedHeader = renderHeader({
      impacts: collectScopeImpacts(analysis, { primaryOnly: true }),
    })

    if (!projectedHeader) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail:
              'No primary release impacts were found, so no canonical PR title header exists.',
          },
        }),
      )
    }

    const rewriteAttempt = yield* ConventionalCommits.Title.rewriteHeader(
      pullRequest.title,
      projectedHeader,
    ).pipe(Effect.result)

    return {
      githubContext,
      pullRequest,
      projectedHeader,
      suggestedTitle: rewriteAttempt._tag === 'Success' ? rewriteAttempt.success : null,
      titleRewriteError: rewriteAttempt._tag === 'Failure' ? rewriteAttempt.failure.message : null,
    }
  })

/**
 * Apply the canonical release header to a connected pull request title,
 * preserving its subject verbatim. Returns `changed: false` when the title is
 * already canonical; otherwise requires a non-empty `GITHUB_TOKEN` and updates
 * the PR title on GitHub, returning the before/after titles.
 *
 * `params.githubLayer` injects the `Github` service directly (e.g. a
 * `Github.Memory` test double); production callers omit it and the connected
 * PR's resolved owner/repo/token are wired to `Github.LiveFetch`.
 */
export const applyPrTitle = (params: {
  readonly pullRequest: Github.PullRequest
  readonly projectedHeader: string
  readonly githubContext: Explorer.ResolvedPullRequestContext
  readonly githubLayer?: Layer.Layer<Github.Github>
}) =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const nextTitle = yield* ConventionalCommits.Title.rewriteHeader(
      params.pullRequest.title,
      params.projectedHeader,
    )

    if (nextTitle === params.pullRequest.title) {
      return { before: params.pullRequest.title, after: params.pullRequest.title, changed: false }
    }

    const token = env.vars['GITHUB_TOKEN']
    if (!token || token.trim() === '') {
      return yield* Effect.fail(
        new Github.GithubConfigError({
          context: { detail: 'GITHUB_TOKEN is required to apply PR title updates.' },
        }),
      )
    }

    const updated = yield* Effect.gen(function* () {
      const github = yield* Github.Github
      return yield* github.updatePullRequest(params.pullRequest.number, { title: nextTitle })
    }).pipe(
      Effect.provide(
        params.githubLayer ??
          Github.LiveFetch({
            owner: params.githubContext.target.owner,
            repo: params.githubContext.target.repo,
            token,
          }),
      ),
    )

    return { before: params.pullRequest.title, after: updated.title, changed: true }
  })
