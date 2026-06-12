import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'

const SemverSchema = Semver.Semver

/**
 * First release of a package - no previous version exists.
 */
export class OfficialFirst extends Sch.TaggedClass<OfficialFirst>()('OfficialFirst', {
  version: SemverSchema,
  bump: Semver.BumpType,
}) {}
