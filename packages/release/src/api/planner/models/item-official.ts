import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { ReleaseCommit } from '../../analyzer/models/commit.js'
import { PackageSchema } from '../../analyzer/models/package-schema.js'
import { OfficialFirst } from '../../version/models/official-first.js'
import { OfficialIncrement } from '../../version/models/official-increment.js'

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
 * An official release plan item.
 */
export class Official extends Sch.TaggedClass<Official>()('Official', {
  ...ItemBaseFields,
  version: S.Union([OfficialFirst, OfficialIncrement]),
}) {
  /** The version this release will produce. Extracts `to` from increments, `version` from firsts. */
  get nextVersion(): Semver.Semver {
    return 'to' in this.version ? this.version.to : this.version.version
  }

  /** The current version before this release, or `None` for first releases. */
  get currentVersion(): Option.Option<Semver.Semver> {
    return 'from' in this.version ? Option.some(this.version.from) : Option.none()
  }

  /** The semver bump type that produced this official release. */
  get bumpType(): Semver.BumpType {
    return this.version.bump
  }
}
