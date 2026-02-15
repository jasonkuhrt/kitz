import type { Analysis } from '../analyzer/models/__.js'
import type { ReleaseCommit } from '../analyzer/models/commit.js'
import type { Recon } from '../explorer/models/__.js'
import { calculateNextVersion } from '../version/calculate.js'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from './models.js'

/**
 * Lifecycle-agnostic impact projection. Peer to Planner.
 *
 * Computes official version projections (always calculable from
 * currentVersion + bump). Does NOT know or care which lifecycle
 * type the Planner will use.
 */
export const forecast = (analysis: Analysis, recon: Recon): Forecast => {
  const { owner, repo } = recon.github.target!
  const { branch, headSha } = recon.git
  const baseUrl = `https://github.com/${owner}/${repo}`

  const releases = analysis.impacts.map((impact) => {
    const nextOfficialVersion = calculateNextVersion(impact.currentVersion, impact.bump)
    return ForecastRelease.make({
      packageName: impact.package.name.moniker,
      packageScope: impact.package.scope,
      bump: impact.bump,
      currentVersion: impact.currentVersion,
      nextOfficialVersion,
      commits: buildCommitDisplays(impact.commits, impact.package.scope, baseUrl),
      sourceUrl: `${baseUrl}/tree/${branch}/packages/${impact.package.scope}`,
    })
  })

  const cascades = analysis.cascades.map((cascade) => {
    const nextOfficialVersion = calculateNextVersion(cascade.currentVersion, 'patch')
    return ForecastCascade.make({
      packageName: cascade.package.name.moniker,
      packageScope: cascade.package.scope,
      currentVersion: cascade.currentVersion,
      nextOfficialVersion,
      triggeredBy: cascade.triggeredBy.map((pkg) => pkg.name.moniker),
      sourceUrl: `${baseUrl}/tree/${branch}/packages/${cascade.package.scope}`,
    })
  })

  return Forecast.make({ owner, repo, branch, headSha, releases, cascades })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildCommitDisplays = (
  commits: readonly ReleaseCommit[],
  scope: string,
  baseUrl: string,
): CommitDisplay[] =>
  commits.map((commit) => {
    const scoped = commit.forScope(scope)
    return CommitDisplay.make({
      shortSha: scoped.hash.slice(0, 7),
      subject: scoped.description,
      type: scoped.type,
      breaking: scoped.breaking,
      commitUrl: `${baseUrl}/commit/${scoped.hash}`,
    })
  })
