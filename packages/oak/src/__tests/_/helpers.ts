import { Prom } from '@kitz/core'
import type { Obj } from '@kitz/core'
import * as z from 'zod/v4'
import * as Command from '../../_entrypoints/__.js'
import type { BuilderCommandState } from '../../builders/command/state.js'
import type { CommandBuilder } from '../../builders/command/types.js'
import { Zod } from '../../extensions/__.js'

type TestCommandBuilder = CommandBuilder<
  Obj.Replace<
    BuilderCommandState.BaseEmpty,
    {
      Extension: typeof Zod
    }
  >
>

// todo enable throw on all tests
export const $: TestCommandBuilder = Command.create().use(Zod) // .settings({ onError: `throw` })

export const assertAssignable = <T>(_: T): [T] => 0 as any
export const as = <T>(): T => undefined as any
export const n = z.number()
export const s = z.string()
export const b = z.boolean()
export const l1 = z.literal(1)
export const e = z.enum([`major`, `minor`, `patch`])
export const tryCatch = <T, E extends Error = Error>(
  fn: () => T,
): T extends Promise<any> ? Promise<Awaited<T> | E> : T | E => {
  try {
    const result = fn() as any
    if (Prom.isShape(result)) {
      return result.catch((error) => {
        return errorFromMaybeError(error)
      }) as any
    }
    return result
  } catch (error) {
    return errorFromMaybeError(error) as any
  }
}

/**
 * Ensure that the given value is an error and return it. If it is not an error than
 * wrap it in one, passing the given value as the error message.
 */
export const errorFromMaybeError = (maybeError: unknown): Error => {
  if (maybeError instanceof Error) return maybeError

  const renderMaybeError = (value: unknown): string => {
    if (
      typeof value === `string` ||
      typeof value === `number` ||
      typeof value === `boolean` ||
      typeof value === `bigint` ||
      typeof value === `symbol` ||
      value === null ||
      value === undefined
    ) {
      return String(value)
    }

    try {
      return JSON.stringify(value)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }

  if (typeof maybeError === `object` && maybeError !== null) {
    try {
      // todo use isomorphic util inspect
      // maybe https://www.npmjs.com/package/object-inspect?
      return new Error(renderMaybeError(maybeError))
    } catch {
      // silently ignore
    }
  }

  return new Error(renderMaybeError(maybeError))
}
