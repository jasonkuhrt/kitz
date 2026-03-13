import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertEquivKind, AssertExactKind, AssertSubKind } from '../../asserts.js'
import { builder } from '../../builder-singleton.js'

export * as equiv from './equiv.js'
export * as exact from './exact.js'
export * as not from './not/__.js'
export * as sub from './sub.js'
// Value-level extractor chaining via builder proxy
export const awaited: typeof builder.parameter5.awaited = builder.parameter5.awaited
export const returned: typeof builder.parameter5.returned = builder.parameter5.returned
export const array: typeof builder.parameter5.array = builder.parameter5.array
export const parameters: typeof builder.parameter5.parameters = builder.parameter5.parameters
export const parameter1: typeof builder.parameter5.parameter1 = builder.parameter5.parameter1
export const parameter2: typeof builder.parameter5.parameter2 = builder.parameter5.parameter2
export const parameter3: typeof builder.parameter5.parameter3 = builder.parameter5.parameter3
export const parameter4: typeof builder.parameter5.parameter4 = builder.parameter5.parameter4
// Unary relators
export const any: typeof builder.parameter5.any = builder.parameter5.any
export const unknown: typeof builder.parameter5.unknown = builder.parameter5.unknown
export const never: typeof builder.parameter5.never = builder.parameter5.never
export const empty: typeof builder.parameter5.empty = builder.parameter5.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter5.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter5.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter5.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
