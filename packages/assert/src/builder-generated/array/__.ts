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
export const awaited: typeof builder.array.awaited = builder.array.awaited
export const returned: typeof builder.array.returned = builder.array.returned
export const parameters: typeof builder.array.parameters = builder.array.parameters
export const parameter1: typeof builder.array.parameter1 = builder.array.parameter1
export const parameter2: typeof builder.array.parameter2 = builder.array.parameter2
export const parameter3: typeof builder.array.parameter3 = builder.array.parameter3
export const parameter4: typeof builder.array.parameter4 = builder.array.parameter4
export const parameter5: typeof builder.array.parameter5 = builder.array.parameter5
// Unary relators
export const any: typeof builder.array.any = builder.array.any
export const unknown: typeof builder.array.unknown = builder.array.unknown
export const never: typeof builder.array.never = builder.array.never
export const empty: typeof builder.array.empty = builder.array.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Array.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
