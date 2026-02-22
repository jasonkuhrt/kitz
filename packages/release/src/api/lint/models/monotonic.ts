import type { Git } from '@kitz/git'
import type { Semver } from '@kitz/semver'

/**
 * Tag info with its commit SHA.
 */
export interface TagInfo {
  readonly tag: string
  readonly version: Semver.Semver
  readonly sha: Git.Sha.Sha
}

/**
 * A violation of monotonic versioning.
 */
export interface Violation {
  readonly existingVersion: Semver.Semver
  readonly existingSha: Git.Sha.Sha
  readonly relationship: 'ancestor' | 'descendant'
  readonly message: string
}

/**
 * Result of monotonic validation for a single release.
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly version: Semver.Semver
  readonly sha: Git.Sha.Sha
  readonly violations: readonly Violation[]
}

/**
 * A violation found during audit.
 */
export interface AuditViolation {
  readonly earlier: TagInfo
  readonly later: TagInfo
  readonly message: string
}

/**
 * Result of a full history audit.
 */
export interface AuditResult {
  readonly packageName: string
  readonly valid: boolean
  readonly releases: readonly TagInfo[]
  readonly violations: readonly AuditViolation[]
}
