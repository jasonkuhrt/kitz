import { Lang, Obj, Str } from '@kitz/core'
import { Either } from 'effect'

export const BooleanLookup = {
  true: true,
  false: false,
} as const

export const environmentVariableBooleanLookup = {
  ...BooleanLookup,
  '1': true,
  '0': false,
} as const

export const stripeDashPrefix = (flagNameInput: string): string => {
  return flagNameInput.replace(/^-+/, ``)
}

export type Values<T> = T[keyof T]

export const getLowerCaseEnvironment = (): NodeJS.ProcessEnv => lowerCaseObjectKeys(process.env)

export const lowerCaseObjectKeys = <$Obj extends Record<string, unknown>>(obj: $Obj): $Obj =>
  Obj.mapKeys(obj, (k) => k.toLowerCase()) as $Obj

export const parseEnvironmentVariableBoolean = (serializedValue: string): Either.Either<boolean, Error> => {
  // @ts-expect-error ignore
  const value = environmentVariableBooleanLookup[serializedValue]
  if (value === undefined) return Either.left(new Error(`Invalid boolean value: ${value}`))
  return Either.right(value)
}

export const parseEnvironmentVariableBooleanOrThrow = (value: string) => {
  const result = parseEnvironmentVariableBoolean(value)
  if (Either.isLeft(result)) {
    Lang.throw(result.left)
  }
  return result.right
}

export const negateNamePattern = /^no([A-Z].+)/

export const stripeNegatePrefix = (name: string): null | string => {
  const withoutPrefix = name.match(negateNamePattern)?.[1]
  if (!withoutPrefix) return null
  const withCamelCase = Str.Case.camel(withoutPrefix)
  return withCamelCase
}

export const stripeNegatePrefixLoose = (name: string): string => {
  const result = stripeNegatePrefix(name)
  return result ? result : name
}
