import type { Fn } from '@kitz/core'
import { Optic } from '@kitz/core'
import type { Result } from 'effect'
import type { AssertEquivKind, AssertExactKind, AssertSubKind } from '../../../asserts.js'
import { builder } from '../../../builder-singleton.js'

export * as equiv from './equiv.js'
export * as exact from './exact.js'
export * as sub from './sub.js'

// Unary relators (negated)
export const any: typeof builder.not.returned.any = builder.not.returned.any
export const unknown: typeof builder.not.returned.unknown = builder.not.returned.unknown
export const never: typeof builder.not.returned.never = builder.not.returned.never
export const empty: typeof builder.not.returned.empty = builder.not.returned.empty
// oxfmt-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never

// oxfmt-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__, true]>
                                                                         : never

// oxfmt-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Result.Failure<infer _, infer __error__>      ? __error__ :
  __$ActualExtracted extends Result.Success<infer __actual__, infer _>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
