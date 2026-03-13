import { Lang } from '@kitz/core'
import { SchemaGetter, Schema as S } from 'effect'
import type { SemverValue } from '../semver-schema.js'
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
  static is = S.is(ComparatorClass as any) as (value: unknown) => value is ComparatorClass

  static Schema = S.String.pipe(
    S.decodeTo(ComparatorClass, {
      decode: SchemaGetter.transform(() => {
        return Lang.todo('Comparator.Schema decode')
      }),
      encode: SchemaGetter.transform((c) => {
        const v = c.version as SemverValue
        const prerelease = v._tag === 'SemverPreRelease' ? `-${v.prerelease.join('.')}` : ''
        const build = v.build?.length ? `+${v.build.join('.')}` : ''
        return `${c.operator}${v.major}.${v.minor}.${v.patch}${prerelease}${build}`
      }),
    }),
  )

  static override toString = S.encodeSync(ComparatorClass.Schema)

  override toString(): string {
    return ComparatorClass.toString(this)
  }
}

export const Comparator: typeof ComparatorClass = ComparatorClass
export type Comparator = ComparatorClass
