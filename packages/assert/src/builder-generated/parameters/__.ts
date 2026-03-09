import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertEquivKind, AssertExactKind, AssertSubKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

export * as equiv from './equiv.js'
export * as exact from './exact.js'
export * as not from './not/__.js'
export * as sub from './sub.js'
// Value-level extractor chaining via builder proxy
export const awaited: typeof builder.parameters.awaited = builder.parameters.awaited
export const returned: typeof builder.parameters.returned = builder.parameters.returned
export const array: typeof builder.parameters.array = builder.parameters.array
export const parameter1: typeof builder.parameters.parameter1 = builder.parameters.parameter1
export const parameter2: typeof builder.parameters.parameter2 = builder.parameters.parameter2
export const parameter3: typeof builder.parameters.parameter3 = builder.parameters.parameter3
export const parameter4: typeof builder.parameters.parameter4 = builder.parameters.parameter4
export const parameter5: typeof builder.parameters.parameter5 = builder.parameters.parameter5
// Unary relators
export const any: typeof builder.parameters.any = builder.parameters.any
export const unknown: typeof builder.parameters.unknown = builder.parameters.unknown
export const never: typeof builder.parameters.never = builder.parameters.never
export const empty: typeof builder.parameters.empty = builder.parameters.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameters.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameters.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameters.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
