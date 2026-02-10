import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option, Schema as S } from 'effect'
import type { AuditResult, AuditViolation, TagInfo, ValidationResult, Violation } from '../models/monotonic.js'

// Re-export types for single-source imports
export type { AuditResult, AuditViolation, TagInfo, ValidationResult, Violation } from '../models/monotonic.js'

/**
 * Parse release tags for a package and get their SHAs.
 *
 * Returns tags sorted by version descending.
 */
export const getPackageTagInfos = (
  packageName: string,
  tags: string[],
): Effect.Effect<TagInfo[], Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tagInfos: TagInfo[] = []
    const decodeExactPin = S.decodeUnknownOption(Pkg.Pin.Exact.FromString)

    for (const tag of tags) {
      const pin = decodeExactPin(tag)
      if (Option.isNone(pin)) continue
      if (pin.value.name.moniker !== packageName) continue
      // Only consider stable versions (no prerelease)
      if (pin.value.version._tag !== 'SemverOfficialRelease') continue

      const sha = yield* git.getTagSha(tag)
      tagInfos.push({ tag, version: pin.value.version, sha })
    }

    // Sort by version descending
    tagInfos.sort((a, b) => -Semver.order(a.version, b.version))
    return tagInfos
  })

/**
 * Validate that a new version can be set at a given SHA without violating
 * monotonic versioning.
 *
 * Uses adjacent-only validation: checks that the new version fits between
 * the immediately preceding and following releases.
 */
export const validateAdjacent = (
  sha: Git.Sha.Sha,
  packageName: string,
  newVersion: Semver.Semver,
  tags: string[],
): Effect.Effect<ValidationResult, Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tagInfos = yield* getPackageTagInfos(packageName, tags)

    const violations: Violation[] = []

    // Find all tags that are ancestors (came before) and descendants (came after)
    let highestAncestor: TagInfo | undefined
    let lowestDescendant: TagInfo | undefined

    for (const info of tagInfos) {
      // Check if this tag's commit is an ancestor of the target SHA
      const tagIsAncestor = yield* git.isAncestor(info.sha, sha)
      if (tagIsAncestor) {
        // This version came before - it should be < newVersion
        if (!highestAncestor || Semver.order(info.version, highestAncestor.version) > 0) {
          highestAncestor = info
        }
      }

      // Check if the target SHA is an ancestor of this tag's commit
      const shaIsAncestor = yield* git.isAncestor(sha, info.sha)
      if (shaIsAncestor) {
        // This version came after - it should be > newVersion
        if (!lowestDescendant || Semver.order(info.version, lowestDescendant.version) < 0) {
          lowestDescendant = info
        }
      }
    }

    // Validate against highest ancestor (must be < newVersion)
    if (highestAncestor && Semver.order(highestAncestor.version, newVersion) >= 0) {
      violations.push({
        existingVersion: highestAncestor.version,
        existingSha: highestAncestor.sha,
        relationship: 'ancestor',
        message: `Version ${highestAncestor.version.toString()} at ${
          highestAncestor.sha.slice(0, 7)
        } is on an EARLIER commit but has version >= ${newVersion.toString()}`,
      })
    }

    // Validate against lowest descendant (must be > newVersion)
    if (lowestDescendant && Semver.order(lowestDescendant.version, newVersion) <= 0) {
      violations.push({
        existingVersion: lowestDescendant.version,
        existingSha: lowestDescendant.sha,
        relationship: 'descendant',
        message: `Version ${lowestDescendant.version.toString()} at ${
          lowestDescendant.sha.slice(0, 7)
        } is on a LATER commit but has version <= ${newVersion.toString()}`,
      })
    }

    return {
      valid: violations.length === 0,
      version: newVersion,
      sha,
      violations,
    }
  })

/**
 * Audit the entire release history for a package.
 *
 * Verifies that versions are strictly monotonically increasing with commit order.
 */
export const auditPackageHistory = (
  packageName: string,
  tags: string[],
): Effect.Effect<AuditResult, Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const tagInfos = yield* getPackageTagInfos(packageName, tags)
    const violations: AuditViolation[] = []

    // For each pair of releases, verify ordering
    for (let i = 0; i < tagInfos.length; i++) {
      for (let j = i + 1; j < tagInfos.length; j++) {
        const a = tagInfos[i]!
        const b = tagInfos[j]!

        // Check if a is ancestor of b (a came before b)
        const aIsAncestorOfB = yield* git.isAncestor(a.sha, b.sha)
        // Check if b is ancestor of a (b came before a)
        const bIsAncestorOfA = yield* git.isAncestor(b.sha, a.sha)

        if (aIsAncestorOfB) {
          // a came before b, so a.version should be < b.version
          if (Semver.order(a.version, b.version) >= 0) {
            violations.push({
              earlier: a,
              later: b,
              message: `${a.version.toString()} at ${a.sha.slice(0, 7)} comes BEFORE ${b.version.toString()} at ${
                b.sha.slice(0, 7)
              }, but has higher/equal version`,
            })
          }
        } else if (bIsAncestorOfA) {
          // b came before a, so b.version should be < a.version
          if (Semver.order(b.version, a.version) >= 0) {
            violations.push({
              earlier: b,
              later: a,
              message: `${b.version.toString()} at ${b.sha.slice(0, 7)} comes BEFORE ${a.version.toString()} at ${
                a.sha.slice(0, 7)
              }, but has higher/equal version`,
            })
          }
        }
        // If neither is ancestor of the other, they're on parallel branches - no violation
      }
    }

    return {
      packageName,
      valid: violations.length === 0,
      releases: tagInfos,
      violations,
    }
  })
