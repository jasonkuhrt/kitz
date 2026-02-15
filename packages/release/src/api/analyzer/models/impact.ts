import type { Semver } from '@kitz/semver'
import type { Option } from 'effect'
import type { ReleaseCommit } from '../commit.js'
import type { Package } from '../workspace.js'

/**
 * Per-package change analysis — what changed and how much.
 */
export interface Impact {
  readonly package: Package
  readonly bump: Semver.BumpType
  readonly commits: ReleaseCommit[]
  readonly currentVersion: Option.Option<Semver.Semver>
}
