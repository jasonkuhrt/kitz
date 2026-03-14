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
export const returned: typeof builder.awaited.returned = builder.awaited.returned
export const array: typeof builder.awaited.array = builder.awaited.array
export const parameters: typeof builder.awaited.parameters = builder.awaited.parameters
export const parameter1: typeof builder.awaited.parameter1 = builder.awaited.parameter1
export const parameter2: typeof builder.awaited.parameter2 = builder.awaited.parameter2
export const parameter3: typeof builder.awaited.parameter3 = builder.awaited.parameter3
export const parameter4: typeof builder.awaited.parameter4 = builder.awaited.parameter4
export const parameter5: typeof builder.awaited.parameter5 = builder.awaited.parameter5
// Unary relators
export const any: typeof builder.awaited.any = builder.awaited.any
export const unknown: typeof builder.awaited.unknown = builder.awaited.unknown
export const never: typeof builder.awaited.never = builder.awaited.never
export const empty: typeof builder.awaited.empty = builder.awaited.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Awaited.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
