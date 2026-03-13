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
export const awaited: typeof builder.parameter1.awaited = builder.parameter1.awaited
export const returned: typeof builder.parameter1.returned = builder.parameter1.returned
export const array: typeof builder.parameter1.array = builder.parameter1.array
export const parameters: typeof builder.parameter1.parameters = builder.parameter1.parameters
export const parameter2: typeof builder.parameter1.parameter2 = builder.parameter1.parameter2
export const parameter3: typeof builder.parameter1.parameter3 = builder.parameter1.parameter3
export const parameter4: typeof builder.parameter1.parameter4 = builder.parameter1.parameter4
export const parameter5: typeof builder.parameter1.parameter5 = builder.parameter1.parameter5
// Unary relators
export const any: typeof builder.parameter1.any = builder.parameter1.any
export const unknown: typeof builder.parameter1.unknown = builder.parameter1.unknown
export const never: typeof builder.parameter1.never = builder.parameter1.never
export const empty: typeof builder.parameter1.empty = builder.parameter1.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter1.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter1.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Parameter1.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__]>
                                                                         : never
