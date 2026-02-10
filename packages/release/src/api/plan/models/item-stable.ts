import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { ReleaseCommit } from '../../release-commit.js'
import type { Package } from '../../scanner.js'
import { StableVersionFirst, StableVersionIncrement } from './stable-version.js'

/**
 * Schema for Package with string path transform.
 * Encoded: `{ scope: string, name: string, path: string }`
 * Decoded: `Package` (with path as AbsDir, name as Moniker)
 */
export const PackageSchema: S.Schema<Package, { scope: string; name: string; path: string }> = S.Struct({
  scope: S.String,
  name: Pkg.Moniker.FromString,
  path: Fs.Path.AbsDir.Schema,
})

/**
 * Common schema properties for all plan items.
 *
 * Note: `commits` stores full `ReleaseCommit` data (hash, author, date, parsed CC).
 * Per-scope flattening happens lazily at changelog generation time.
 */
export const ItemBaseFields = {
  package: PackageSchema,
  commits: S.Array(ReleaseCommit),
}

/**
 * A stable release plan item.
 */
export class Stable extends S.Class<Stable>('Stable')({
  ...ItemBaseFields,
  version: S.Union(StableVersionFirst, StableVersionIncrement),
}) {
  static is = S.is(Stable)

  get nextVersion(): Semver.Semver {
    return 'to' in this.version ? this.version.to : this.version.version
  }

  get currentVersion(): Option.Option<Semver.Semver> {
    return 'from' in this.version ? Option.some(this.version.from) : Option.none()
  }

  get bumpType(): Semver.BumpType {
    return 'bump' in this.version ? this.version.bump : 'minor'
  }
}
