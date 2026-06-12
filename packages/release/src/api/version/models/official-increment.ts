import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'

const SemverSchema = Semver.Semver

/**
 * Increment from an existing version.
 */
export class OfficialIncrement extends Sch.TaggedClass<OfficialIncrement>()('OfficialIncrement', {
  from: SemverSchema,
  to: SemverSchema,
  bump: Semver.BumpType,
}) {}
