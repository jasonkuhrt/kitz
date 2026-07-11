import { Order, Schema as S } from 'effect'
import type { LiteralGuard } from '../core/literal.js'
import { Any } from '../models/Any.js'

const groupRank = (path: Any): 0 | 1 => (path._tag === 'AbsFile' || path._tag === 'AbsDir' ? 0 : 1)

const ascentOf = (path: Any): number =>
  path._tag === 'RelFile' || path._tag === 'RelDir' ? path.ascent : 0

const kindRank = (path: Any): 0 | 1 => (path._tag === 'AbsDir' || path._tag === 'RelDir' ? 0 : 1)

const fileNameOf = (path: Any): string =>
  path._tag === 'AbsFile' || path._tag === 'RelFile' ? path.fileName.name : ''

/**
 * Total ordering for all path values: absolute before relative, then ascent,
 * segments lexicographically (shorter prefix first), directories before files,
 * then filename. Each dimension is one `mapInput` entry, tie-broken in order.
 *
 * @example
 * ```ts
 * paths.toSorted(Path.order)
 * ```
 */
const orderValues: Order.Order<Any> = Order.combineAll([
  Order.mapInput(Order.Number, groupRank),
  Order.mapInput(Order.Number, ascentOf),
  Order.mapInput(Order.Array(Order.String), (path: Any) => path.segments),
  Order.mapInput(Order.Number, kindRank),
  Order.mapInput(Order.String, fileNameOf),
])

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
