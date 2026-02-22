import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'

/**
 * Commit attribution for display.
 */
export class CommitDisplay extends S.TaggedClass<CommitDisplay>()('CommitDisplay', {
  shortSha: S.String,
  subject: S.String,
  type: S.String,
  breaking: S.Boolean,
  commitUrl: S.String,
}) {
  static is = S.is(CommitDisplay)
}

/**
 * A forecasted primary release — lifecycle-agnostic impact projection.
 */
export class ForecastRelease extends S.TaggedClass<ForecastRelease>()('ForecastRelease', {
  packageName: S.String,
  packageScope: S.String,
  bump: Semver.BumpType,
  currentVersion: S.OptionFromNullOr(Semver.Schema),
  nextOfficialVersion: Semver.Semver,
  commits: S.Array(CommitDisplay),
  sourceUrl: S.String,
}) {
  static is = S.is(ForecastRelease)

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
export class ForecastCascade extends S.TaggedClass<ForecastCascade>()('ForecastCascade', {
  packageName: S.String,
  packageScope: S.String,
  currentVersion: S.OptionFromNullOr(Semver.Schema),
  nextOfficialVersion: Semver.Semver,
  triggeredBy: S.Array(S.String),
  sourceUrl: S.String,
}) {
  static is = S.is(ForecastCascade)
}

/**
 * Impact projection — lifecycle-agnostic view of "what would happen".
 *
 * No `lifecycle` field. No lifecycle-specific version strings.
 * Every release shows `nextOfficialVersion` — always calculable
 * from `currentVersion + bump`.
 */
export class Forecast extends S.TaggedClass<Forecast>()('Forecast', {
  owner: S.String,
  repo: S.String,
  branch: S.String,
  headSha: S.String,
  releases: S.Array(ForecastRelease),
  cascades: S.Array(ForecastCascade),
}) {
  static is = S.is(Forecast)
}
