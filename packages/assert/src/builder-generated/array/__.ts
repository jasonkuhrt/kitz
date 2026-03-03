import type { Fn } from '@kitz/core'
import { builder } from '../../builder-singleton.js'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind, AssertEquivKind, AssertSubKind } from '../../asserts.js'

export * as exact from './exact.js'
export * as equiv from './equiv.js'
export * as sub from './sub.js'
export * as not from './not/__.js'
// Value-level extractor chaining via builder proxy
export const awaited = builder.array.awaited
export const returned = builder.array.returned
export const parameters = builder.array.parameters
export const parameter1 = builder.array.parameter1
export const parameter2 = builder.array.parameter2
export const parameter3 = builder.array.parameter3
export const parameter4 = builder.array.parameter4
export const parameter5 = builder.array.parameter5
// Unary relators
export const any = builder.array.any
export const unknown = builder.array.unknown
export const never = builder.array.never
export const empty = builder.array.empty
// dprint-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// dprint-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// dprint-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
