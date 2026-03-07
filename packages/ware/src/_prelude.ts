// Utilities from Graffle prelude needed by ware

import { Prom } from '@kitz/core'
export type SomeFunctionMaybeAsync = (...args: any[]) => Prom.Maybe<any>

export type GuardedType<$T> = $T extends ((x: any) => x is infer $U) ? $U : never

export const isAnyFunction = (value: unknown): value is (...args: any[]) => any => {
  return typeof value === 'function'
}

export namespace Objekt {
  export type IsEmpty<$T> = {} extends $T ? true : false
}
