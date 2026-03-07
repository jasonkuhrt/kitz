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
export const awaited: typeof builder.parameter2.awaited = builder.parameter2.awaited
export const returned: typeof builder.parameter2.returned = builder.parameter2.returned
export const array: typeof builder.parameter2.array = builder.parameter2.array
export const parameters: typeof builder.parameter2.parameters = builder.parameter2.parameters
export const parameter1: typeof builder.parameter2.parameter1 = builder.parameter2.parameter1
export const parameter3: typeof builder.parameter2.parameter3 = builder.parameter2.parameter3
export const parameter4: typeof builder.parameter2.parameter4 = builder.parameter2.parameter4
export const parameter5: typeof builder.parameter2.parameter5 = builder.parameter2.parameter5
// Unary relators
export const any: typeof builder.parameter2.any = builder.parameter2.any
export const unknown: typeof builder.parameter2.unknown = builder.parameter2.unknown
export const never: typeof builder.parameter2.never = builder.parameter2.never
export const empty: typeof builder.parameter2.empty = builder.parameter2.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter2.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter2.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter2.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
