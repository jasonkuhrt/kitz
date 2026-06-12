import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { ReleaseCommit } from './commit.js'
import { PackageSchema } from './package-schema.js'

const CurrentVersionSchema = Semver.OptionFromNullOrString

/**
 * Per-package change analysis — what changed and how much.
 */
export class Impact extends Sch.TaggedClass<Impact>()('Impact', {
  package: PackageSchema,
  bump: Semver.BumpType,
  commits: S.Array(ReleaseCommit),
  currentVersion: CurrentVersionSchema,
}) {}
