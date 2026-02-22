import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { Operator } from './operator.js'

/**
 * Single version comparator: `>=1.0.0`, `<2.0.0`, `1.0.0`
 *
 * Represents one atomic comparison in a range expression.
 */
export class Comparator extends S.Class<Comparator>('PkgRangeComparator')({
  operator: Operator,
  version: Semver.Semver,
}) {
  static is = S.is(Comparator)

  static Schema: S.Schema<Comparator, string> = S.transform(
    S.String,
    Comparator,
    {
      strict: true,
      decode: () => {
        throw new Error('Comparator.Schema decode not implemented - use Range.Schema')
      },
      encode: (c) => {
        const v = c.version
        const prerelease = v._tag === 'SemverPreRelease' ? `-${v.prerelease.join('.')}` : ''
        const build = v.build?.length ? `+${v.build.join('.')}` : ''
        return `${c.operator}${v.major}.${v.minor}.${v.patch}${prerelease}${build}`
      },
    },
  )

  static override toString = S.encodeSync(Comparator.Schema)

  override toString(): string {
    return Comparator.toString(this)
  }
}
