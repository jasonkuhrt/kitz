import { Result } from 'effect'
import type { PackageLocationError } from '../analyzer/errors.js'
import type { Analysis } from '../analyzer/models/__.js'
import type { ScopedCommitSource } from '../analyzer/models/commit.js'
import { ReleaseCommit } from '../analyzer/models/commit.js'
import { PackageLocation } from '../analyzer/package-location.js'
import type { Recon } from '../explorer/models/__.js'
import type { GitIdentity } from '../explorer/models/git-identity.js'
import { calculateNextVersion } from '../version/calculate.js'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from './models.js'

/**
 * A {@link Recon} whose GitHub target has been proven present.
 *
 * Forecasting builds GitHub URLs from `owner`/`repo`, so callers must narrow
 * `recon.github.target` to non-null before forecasting. This makes "no target
 * resolved" unrepresentable here instead of a runtime crash.
 */
export type ReconWithGithubTarget = Recon & {
  readonly github: Recon['github'] & { readonly target: GitIdentity }
}

/**
 * Narrow a {@link Recon} to {@link ReconWithGithubTarget}.
 */
export const hasGithubTarget = (recon: Recon): recon is ReconWithGithubTarget =>
  recon.github.target !== null

/**
 * Lifecycle-agnostic impact projection. Peer to Planner.
 *
 * Computes official version projections (always calculable from
 * currentVersion + bump). Does NOT know or care which lifecycle
 * type the Planner will use.
 *
 * Fails with a typed {@link PackageLocationError} when an analyzed package's
 * path cannot be expressed relative to the repo root (no source URL exists
 * for it).
 */
export const forecast = (
  analysis: Analysis,
  recon: ReconWithGithubTarget,
): Result.Result<Forecast, PackageLocationError> =>
  Result.gen(function* () {
    const { owner, repo } = recon.github.target
    const { root, branch, headSha } = recon.git
    const baseUrl = `https://github.com/${owner}/${repo}`

    const releases: ForecastRelease[] = []
    for (const impact of analysis.impacts) {
      const nextOfficialVersion = calculateNextVersion(impact.currentVersion, impact.bump)
      const location = yield* PackageLocation.fromAbsolutePath(root, impact.package.path)
      releases.push(
        ForecastRelease.make({
          packageName: impact.package.name.moniker,
          packageScope: impact.package.scope,
          bump: impact.bump,
          currentVersion: impact.currentVersion,
          nextOfficialVersion,
          commits: buildCommitDisplays(impact.commits, impact.package.scope, baseUrl),
          sourceUrl: PackageLocation.toSourceUrl(location, { owner, repo, branch }),
        }),
      )
    }

    const cascades: ForecastCascade[] = []
    for (const cascade of analysis.cascades) {
      const nextOfficialVersion = calculateNextVersion(cascade.currentVersion, 'patch')
      const location = yield* PackageLocation.fromAbsolutePath(root, cascade.package.path)
      cascades.push(
        ForecastCascade.make({
          packageName: cascade.package.name.moniker,
          packageScope: cascade.package.scope,
          currentVersion: cascade.currentVersion,
          nextOfficialVersion,
          triggeredBy: cascade.triggeredBy.map((pkg) => pkg.name.moniker),
          sourceUrl: PackageLocation.toSourceUrl(location, { owner, repo, branch }),
        }),
      )
    }

    return Forecast.make({ owner, repo, branch, headSha, releases, cascades })
  })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert raw release commits to display-friendly format for PR comments.
 *
 * Extracts scope-specific info (type, description, breaking flag) and
 * builds GitHub commit URLs from the repository base URL.
 */
const buildCommitDisplays = (
  commits: readonly ScopedCommitSource[],
  scope: string,
  baseUrl: string,
): CommitDisplay[] =>
  commits.map((commit) => {
    const scoped = ReleaseCommit.forScope(commit, scope)
    return CommitDisplay.make({
      shortSha: scoped.hash.slice(0, 7),
      subject: scoped.description,
      type: scoped.type.value,
      breaking: scoped.breaking,
      commitUrl: `${baseUrl}/commit/${scoped.hash}`,
    })
  })
