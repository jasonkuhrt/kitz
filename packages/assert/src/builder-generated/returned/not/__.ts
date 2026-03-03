import type { Fn } from '@kitz/core'
import { builder } from '../../../builder-singleton.js'
import { Optic } from '@kitz/core'
import type { Either } from 'effect'
import type { AssertExactKind, AssertEquivKind, AssertSubKind } from '../../../asserts.js'

export * as exact from './exact.js'
export * as equiv from './equiv.js'
export * as sub from './sub.js'

// Unary relators (negated)
export const any = builder.not.returned.any
export const unknown = builder.not.returned.unknown
export const never = builder.not.returned.never
export const empty = builder.not.returned.empty
// dprint-ignore
export type exact<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertExactKind, [$Expected, __actual__, true]>
                                                                         : never

// dprint-ignore
export type equiv<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertEquivKind, [$Expected, __actual__, true]>
                                                                         : never

// dprint-ignore
export type sub<
  $Expected,
  $Actual,
  __$ActualExtracted = Optic.Returned.Get<$Actual>,
> =
  __$ActualExtracted extends Either.Left<infer __error__, infer _>      ? __error__ :
  __$ActualExtracted extends Either.Right<infer _, infer __actual__>    ? Fn.Kind.Apply<AssertSubKind, [$Expected, __actual__, true]>
                                                                         : never
