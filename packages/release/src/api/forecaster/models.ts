import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'

const OptionalSemverSchema = S.OptionFromNullOr(Semver.Schema)
const SemverSchema = Semver.Semver

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
  static make = this.makeUnsafe
  static is = S.is(CommitDisplay)
  static decode = S.decodeUnknownEffect(CommitDisplay)
  static decodeSync = S.decodeUnknownSync(CommitDisplay)
  static encode = S.encodeUnknownEffect(CommitDisplay)
  static encodeSync = S.encodeUnknownSync(CommitDisplay)
  static equivalence = S.toEquivalence(CommitDisplay)
  static ordered = false as const
}

/**
 * A forecasted primary release — lifecycle-agnostic impact projection.
 */
export class ForecastRelease extends S.TaggedClass<ForecastRelease>()('ForecastRelease', {
  packageName: S.String,
  packageScope: S.String,
  bump: Semver.BumpType,
  currentVersion: OptionalSemverSchema,
  nextOfficialVersion: SemverSchema,
  commits: S.Array(CommitDisplay),
  sourceUrl: S.String,
}) {
  static make = this.makeUnsafe
  static is = S.is(ForecastRelease)
  static decode = S.decodeUnknownEffect(ForecastRelease)
  static decodeSync = S.decodeUnknownSync(ForecastRelease)
  static encode = S.encodeUnknownEffect(ForecastRelease)
  static encodeSync = S.encodeUnknownSync(ForecastRelease)
  static equivalence = S.toEquivalence(ForecastRelease)
  static ordered = false as const

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
  currentVersion: OptionalSemverSchema,
  nextOfficialVersion: SemverSchema,
  triggeredBy: S.Array(S.String),
  sourceUrl: S.String,
}) {
  static make = this.makeUnsafe
  static is = S.is(ForecastCascade)
  static decode = S.decodeUnknownEffect(ForecastCascade)
  static decodeSync = S.decodeUnknownSync(ForecastCascade)
  static encode = S.encodeUnknownEffect(ForecastCascade)
  static encodeSync = S.encodeUnknownSync(ForecastCascade)
  static equivalence = S.toEquivalence(ForecastCascade)
  static ordered = false as const
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
  static make = this.makeUnsafe
  static is = S.is(Forecast)
  static decode = S.decodeUnknownEffect(Forecast)
  static decodeSync = S.decodeUnknownSync(Forecast)
  static encode = S.encodeUnknownEffect(Forecast)
  static encodeSync = S.encodeUnknownSync(Forecast)
  static equivalence = S.toEquivalence(Forecast)
  static ordered = false as const
}
