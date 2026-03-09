import { Lang } from '@kitz/core'
import { Schema as S } from 'effect'
import { SemverSelf } from '../semver-schema.js'
import { Operator } from './operator.js'

/**
 * Single version comparator: `>=1.0.0`, `<2.0.0`, `1.0.0`
 *
 * Represents one atomic comparison in a range expression.
 */
class ComparatorClass extends S.Class<ComparatorClass>('PkgRangeComparator')({
  operator: Operator,
  version: SemverSelf,
}) {
  static is = S.is(ComparatorClass)

  static Schema: S.Schema<ComparatorClass, string> = S.transform(S.String, ComparatorClass, {
    strict: true,
    decode: () => {
      return Lang.todo('Comparator.Schema decode')
    },
    encode: (c) => {
      const v = c.version
      const prerelease = v._tag === 'SemverPreRelease' ? `-${v.prerelease.join('.')}` : ''
      const build = v.build?.length ? `+${v.build.join('.')}` : ''
      return `${c.operator}${v.major}.${v.minor}.${v.patch}${prerelease}${build}`
    },
  })

  static override toString = S.encodeSync(ComparatorClass.Schema)

  override toString(): string {
    return ComparatorClass.toString(this)
  }
}

export const Comparator: typeof ComparatorClass = ComparatorClass
export type Comparator = ComparatorClass
