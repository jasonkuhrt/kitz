import type { Analysis } from './analyzer/models/analysis.js'
import { ConventionalCommits } from '@kitz/conventional-commits'
import type { Semver } from '@kitz/semver'
import { Result, Option } from 'effect'

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
  options?: { readonly scopes?: readonly string[] },
): readonly ScopeImpact[] => {
  const allowedScopes = options?.scopes ?? null
  const impacts = analysis.impacts
    .filter((impact) => (allowedScopes ? allowedScopes.includes(impact.package.scope) : true))
    .map((impact) => ({
      scope: impact.package.scope,
      bump: impact.bump,
    }))

  return normalizeScopes(impacts.map((impact) => impact.scope)).map((scope) => {
    const scopedImpacts = impacts.filter((impact) => impact.scope === scope)
    const bump = scopedImpacts.some((impact) => impact.bump === 'major')
      ? 'major'
      : scopedImpacts.some((impact) => impact.bump === 'minor')
        ? 'minor'
        : 'patch'
    return { scope, bump } satisfies ScopeImpact
  })
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
  new ConventionalCommits.Target({
    type: ConventionalCommits.Type.parse(impact.bump === 'patch' ? 'fix' : 'feat'),
    scope: impact.scope,
    breaking: impact.bump === 'major',
  })

export const renderHeader = (params: {
  readonly impacts: readonly ScopeImpact[]
}): string | null => {
  if (params.impacts.length === 0) return null

  const commit = new ConventionalCommits.Commit.Multi({
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
