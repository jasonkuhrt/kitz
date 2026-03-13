import { Str } from '@kitz/core'
import { Result } from 'effect'
import { negateNamePattern, stripeDashPrefix } from '../helpers.js'
import type { Parameter } from '../Parameter/types.js'
import * as SchemaRuntime from '../schema/schema-runtime.js'
import type { Value } from './types.js'

export { stripeDashPrefix }

export const parseSerializedValue = (
  name: string,
  serializedValue: string,
  spec: Parameter,
): Result.Result<Value, Error> => {
  const either = SchemaRuntime.deserialize(spec.type, serializedValue)

  if (Result.isFailure(either)) {
    return Result.fail(either.failure)
  }

  const value = either.success
  if (typeof value === `string`) return Result.succeed({ _tag: `string`, value })
  if (typeof value === `number`) return Result.succeed({ _tag: `number`, value })
  if (value === undefined) return Result.succeed({ _tag: `undefined`, value: undefined })
  if (typeof value === `boolean`) {
    return Result.succeed({ _tag: `boolean`, value, negated: isEnvarNegated(name, spec) })
  }

  return Result.fail(new Error(`Unsupported type ${typeof value}.`))
}

/**
 * Is the environment variable input negated? Unlike line input the environment can be
 * namespaced so a bit more work is needed to parse out the name pattern.
 */
export const isEnvarNegated = (name: string, spec: Parameter): boolean => {
  const nameWithNamespaceStripped = stripeNamespace(name, spec)
  // dump({ nameWithNamespaceStripped })
  return negateNamePattern.test(nameWithNamespaceStripped)
}

export const isNegated = (name: string): boolean => {
  return negateNamePattern.test(name)
}

const stripeNamespace = (name: string, spec: Parameter): string => {
  for (const namespace of spec.environment?.namespaces ?? []) {
    if (name.startsWith(namespace)) return Str.Case.camel(name.slice(namespace.length))
  }
  return name
}
