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
export const awaited: typeof builder.returned.awaited = builder.returned.awaited
export const array: typeof builder.returned.array = builder.returned.array
export const parameters: typeof builder.returned.parameters = builder.returned.parameters
export const parameter1: typeof builder.returned.parameter1 = builder.returned.parameter1
export const parameter2: typeof builder.returned.parameter2 = builder.returned.parameter2
export const parameter3: typeof builder.returned.parameter3 = builder.returned.parameter3
export const parameter4: typeof builder.returned.parameter4 = builder.returned.parameter4
export const parameter5: typeof builder.returned.parameter5 = builder.returned.parameter5
// Unary relators
export const any: typeof builder.returned.any = builder.returned.any
export const unknown: typeof builder.returned.unknown = builder.returned.unknown
export const never: typeof builder.returned.never = builder.returned.never
export const empty: typeof builder.returned.empty = builder.returned.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
