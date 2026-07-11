import { Order, Schema as S } from 'effect'
import type { LiteralGuard } from '../core/literal.js'
import { Any } from '../models/Any.js'

const compareNumber = (self: number, that: number): -1 | 0 | 1 =>
  self < that ? -1 : self > that ? 1 : 0

const groupRank = (path: Any): 0 | 1 => (path._tag === 'AbsFile' || path._tag === 'AbsDir' ? 0 : 1)

const ascentOf = (path: Any): number =>
  path._tag === 'RelFile' || path._tag === 'RelDir' ? path.ascent : 0

const kindRank = (path: Any): 0 | 1 => (path._tag === 'AbsDir' || path._tag === 'RelDir' ? 0 : 1)

const fileNameOf = (path: Any): string =>
  path._tag === 'AbsFile' || path._tag === 'RelFile' ? path.fileName.name : ''

const compareSegments = (self: Any, that: Any): -1 | 0 | 1 => {
  const length = Math.min(self.segments.length, that.segments.length)
  for (let index = 0; index < length; index++) {
    const result = Order.String(self.segments[index]!, that.segments[index]!)
    if (result !== 0) return result
  }
  return compareNumber(self.segments.length, that.segments.length)
}

/**
 * Total ordering for all path values: absolute before relative, then ascent,
 * segments lexicographically, directories before files, then filename.
 *
 * @example
 * ```ts
 * paths.toSorted(Path.order)
 * ```
 */
const orderValues: Order.Order<Any> = Order.make((self, that) => {
  const byGroup = compareNumber(groupRank(self), groupRank(that))
  if (byGroup !== 0) return byGroup

  const byAscent = compareNumber(ascentOf(self), ascentOf(that))
  if (byAscent !== 0) return byAscent

  const bySegments = compareSegments(self, that)
  if (bySegments !== 0) return bySegments

  const byKind = compareNumber(kindRank(self), kindRank(that))
  if (byKind !== 0) return byKind

  return Order.String(fileNameOf(self), fileNameOf(that))
})

export function order<const $Self extends Any | string, const $That extends Any | string>(
  self: $Self extends string ? LiteralGuard<$Self, Any> : $Self,
  that: $That extends string ? LiteralGuard<$That, Any> : $That,
): -1 | 0 | 1
export function order(self: Any, that: Any): -1 | 0 | 1
export function order(self: Any | string, that: Any | string): -1 | 0 | 1 {
  const selfValue: Any = typeof self === 'string' ? S.decodeSync(Any)(self) : self
  const thatValue: Any = typeof that === 'string' ? S.decodeSync(Any)(that) : that
  return orderValues(selfValue, thatValue)
}
