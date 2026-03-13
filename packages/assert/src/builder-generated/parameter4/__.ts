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
export const awaited: typeof builder.parameter4.awaited = builder.parameter4.awaited
export const returned: typeof builder.parameter4.returned = builder.parameter4.returned
export const array: typeof builder.parameter4.array = builder.parameter4.array
export const parameters: typeof builder.parameter4.parameters = builder.parameter4.parameters
export const parameter1: typeof builder.parameter4.parameter1 = builder.parameter4.parameter1
export const parameter2: typeof builder.parameter4.parameter2 = builder.parameter4.parameter2
export const parameter3: typeof builder.parameter4.parameter3 = builder.parameter4.parameter3
export const parameter5: typeof builder.parameter4.parameter5 = builder.parameter4.parameter5
// Unary relators
export const any: typeof builder.parameter4.any = builder.parameter4.any
export const unknown: typeof builder.parameter4.unknown = builder.parameter4.unknown
export const never: typeof builder.parameter4.never = builder.parameter4.never
export const empty: typeof builder.parameter4.empty = builder.parameter4.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter4.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter4.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter4.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
