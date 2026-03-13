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
export const awaited: typeof builder.parameter3.awaited = builder.parameter3.awaited
export const returned: typeof builder.parameter3.returned = builder.parameter3.returned
export const array: typeof builder.parameter3.array = builder.parameter3.array
export const parameters: typeof builder.parameter3.parameters = builder.parameter3.parameters
export const parameter1: typeof builder.parameter3.parameter1 = builder.parameter3.parameter1
export const parameter2: typeof builder.parameter3.parameter2 = builder.parameter3.parameter2
export const parameter4: typeof builder.parameter3.parameter4 = builder.parameter3.parameter4
export const parameter5: typeof builder.parameter3.parameter5 = builder.parameter3.parameter5
// Unary relators
export const any: typeof builder.parameter3.any = builder.parameter3.any
export const unknown: typeof builder.parameter3.unknown = builder.parameter3.unknown
export const never: typeof builder.parameter3.never = builder.parameter3.never
export const empty: typeof builder.parameter3.empty = builder.parameter3.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter3.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
