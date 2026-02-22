import type { Fn } from '@kitz/core'
import type { AssertEquivKind, AssertExactKind, AssertSubKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

export * as equiv from './equiv.js'
export * as exact from './exact.js'
export * as sub from './sub.js'

// Unary relators (negated)
export const any = builder.not.any
export const unknown = builder.not.unknown
export const never = builder.not.never
export const empty = builder.not.empty
export type exact<$Expected, $Actual> = Fn.Kind.Apply<AssertExactKind, [$Expected, $Actual, true]>

export type equiv<$Expected, $Actual> = Fn.Kind.Apply<AssertEquivKind, [$Expected, $Actual, true]>

export type sub<$Expected, $Actual> = Fn.Kind.Apply<AssertSubKind, [$Expected, $Actual, true]>
