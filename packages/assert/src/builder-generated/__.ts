import type { Fn } from '@kitz/core'
import { builder } from '../builder-singleton.js'
import type { AssertExactKind, AssertEquivKind, AssertSubKind } from '../asserts.js'

export * as exact from './exact.js'
export * as equiv from './equiv.js'
export * as sub from './sub.js'
export * as not from './not/__.js'
export * as awaited from './awaited/__.js'
export * as returned from './returned/__.js'
export * as array from './array/__.js'
export * as parameters from './parameters/__.js'
export * as parameter1 from './parameter1/__.js'
export * as parameter2 from './parameter2/__.js'
export * as parameter3 from './parameter3/__.js'
export * as parameter4 from './parameter4/__.js'
export * as parameter5 from './parameter5/__.js'
// Unary relators
export const any = builder.any
export const unknown = builder.unknown
export const never = builder.never
export const empty = builder.empty
export type exact<$Expected, $Actual> = Fn.Kind.Apply<AssertExactKind, [$Expected, $Actual]>
export type equiv<$Expected, $Actual> = Fn.Kind.Apply<AssertEquivKind, [$Expected, $Actual]>
export type sub<$Expected, $Actual> = Fn.Kind.Apply<AssertSubKind, [$Expected, $Actual]>
