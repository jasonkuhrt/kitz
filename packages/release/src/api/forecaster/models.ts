import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'

const OptionalSemverSchema = Semver.OptionFromNullOrString
const SemverSchema = Semver.Semver

/**
 * Commit attribution for display.
 */
export class CommitDisplay extends Sch.TaggedClass<CommitDisplay>()('CommitDisplay', {
  shortSha: S.String,
  subject: S.String,
  type: S.String,
  breaking: S.Boolean,
  commitUrl: S.String,
}) {}

/**
 * A forecasted primary release — lifecycle-agnostic impact projection.
 */
export class ForecastRelease extends Sch.TaggedClass<ForecastRelease>()('ForecastRelease', {
  packageName: S.String,
  packageScope: S.String,
  bump: Semver.BumpType,
  currentVersion: OptionalSemverSchema,
  nextOfficialVersion: SemverSchema,
  commits: S.Array(CommitDisplay),
  sourceUrl: S.String,
}) {
  get currentVersionDisplay(): string {
    return Option.match(this.currentVersion, {
      onNone: () => 'new',
      onSome: (v) => v.toString(),
    })
  }
}

/**
 * A forecasted cascade release.
 */
export class ForecastCascade extends Sch.TaggedClass<ForecastCascade>()('ForecastCascade', {
  packageName: S.String,
  packageScope: S.String,
  currentVersion: OptionalSemverSchema,
  nextOfficialVersion: SemverSchema,
  triggeredBy: S.Array(S.String),
  sourceUrl: S.String,
}) {}

/**
 * Impact projection — lifecycle-agnostic view of "what would happen".
 *
 * No `lifecycle` field. No lifecycle-specific version strings.
 * Every release shows `nextOfficialVersion` — always calculable
 * from `currentVersion + bump`.
 */
export class Forecast extends Sch.TaggedClass<Forecast>()('Forecast', {
  owner: S.String,
  repo: S.String,
  branch: S.String,
  headSha: S.String,
  releases: S.Array(ForecastRelease),
  cascades: S.Array(ForecastCascade),
}) {}
