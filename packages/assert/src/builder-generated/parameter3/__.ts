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
export const awaited = builder.parameter3.awaited
export const returned = builder.parameter3.returned
export const array = builder.parameter3.array
export const parameters = builder.parameter3.parameters
export const parameter1 = builder.parameter3.parameter1
export const parameter2 = builder.parameter3.parameter2
export const parameter4 = builder.parameter3.parameter4
export const parameter5 = builder.parameter3.parameter5
// Unary relators
export const any = builder.parameter3.any
export const unknown = builder.parameter3.unknown
export const never = builder.parameter3.never
export const empty = builder.parameter3.empty
// dprint-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// dprint-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// dprint-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
