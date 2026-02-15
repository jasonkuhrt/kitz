import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { makePreviewPrerelease, makePrPrerelease } from '../analyzer/prerelease.js'

/**
 * Calculate the next version given a current version and bump type.
 *
 * Applies phase-aware bump mapping:
 * - Initial phase (0.x.x): major/minor -> minor, patch -> patch
 * - Public phase (1.x.x+): standard semver semantics
 */
export const calculateNextVersion = (
  current: Option.Option<Semver.Semver>,
  bump: Semver.BumpType,
): Semver.Semver =>
  Option.match(current, {
    onNone: () => {
      // First release - ALWAYS start in initial phase (0.x.x)
      switch (bump) {
        case 'major':
        case 'minor':
          return Semver.make(0, 1, 0)
        case 'patch':
          return Semver.make(0, 0, 1)
      }
    },
    onSome: (version) => {
      // Apply phase-aware bump mapping
      const effectiveBump = Semver.mapBumpForPhase(version, bump)
      return Semver.increment(version, effectiveBump)
    },
  })

/**
 * Graduate from initial phase to public phase (1.0.0).
 *
 * This is a one-way operation that declares "the API is now stable".
 * Should only be called explicitly, never automatically from commits.
 *
 * @deprecated Use {@link Semver.one} directly instead.
 */
export const graduatePhase = (): Semver.Semver => Semver.one

/**
 * Calculate the next preview version.
 *
 * Format: `${nextStableVersion}-next.${n}`
 */
export const calculatePreviewVersion = (
  nextStableVersion: Semver.Semver,
  existingPreviewNumber: number,
): Semver.Semver => {
  const prerelease = makePreviewPrerelease(existingPreviewNumber + 1)
  return Semver.withPre(nextStableVersion, ['next', prerelease.iteration])
}

/**
 * Calculate the next PR version.
 *
 * Format: `0.0.0-pr.${prNumber}.${n}.${sha}`
 */
export const calculatePrVersion = (
  prNumber: number,
  existingPrNumber: number,
  sha: Git.Sha.Sha,
): Semver.Semver => {
  const prerelease = makePrPrerelease(prNumber, existingPrNumber + 1, sha)
  return Semver.withPre(Semver.zero, ['pr', prerelease.prNumber, prerelease.iteration, prerelease.sha])
}
