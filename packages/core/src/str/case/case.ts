import { snakeCase } from 'es-toolkit'

/**
 * Convert string to camelCase.
 * @category Case Conversion
 * @example
 * ```typescript
 * camel('hello-world') // 'helloWorld'
 * camel('foo_bar') // 'fooBar'
 * ```
 */
export { camelCase as camel } from 'es-toolkit'

/**
 * Convert string to kebab-case.
 * @category Case Conversion
 * @example
 * ```typescript
 * kebab('helloWorld') // 'hello-world'
 * kebab('FooBar') // 'foo-bar'
 * ```
 */
export { kebabCase as kebab } from 'es-toolkit'

/**
 * Convert string to PascalCase.
 * @category Case Conversion
 * @example
 * ```typescript
 * pascal('hello-world') // 'HelloWorld'
 * pascal('foo_bar') // 'FooBar'
 * ```
 */
export { pascalCase as pascal } from 'es-toolkit'

/**
 * Convert string to snake_case.
 * @category Case Conversion
 * @example
 * ```typescript
 * snake('helloWorld') // 'hello_world'
 * snake('FooBar') // 'foo_bar'
 * ```
 */
export { snakeCase as snake } from 'es-toolkit'

/**
 * Convert string to CONSTANT_CASE (SCREAMING_SNAKE_CASE).
 * Commonly used for environment variables and constants.
 * @category Case Conversion
 * @param name - The string to convert
 * @returns The constant cased string
 * @example
 * ```typescript
 * constant('helloWorld') // 'HELLO_WORLD'
 * constant('foo-bar') // 'FOO_BAR'
 * constant('myEnvVar') // 'MY_ENV_VAR'
 * ```
 */
export const constant = (name: string): string => snakeCase(name).toUpperCase()

/**
 * Convert string to Title Case.
 * Replaces hyphens and underscores with spaces and capitalizes the first letter of each word.
 * @category Case Conversion
 * @param str - The string to convert
 * @returns The title cased string
 * @example
 * ```typescript
 * title('hello-world') // 'Hello World'
 * title('foo_bar') // 'Foo Bar'
 * title('the quick brown fox') // 'The Quick Brown Fox'
 * ```
 */
export const title = (str: string) => {
  return str.replaceAll(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

/**
 * Convert string to UPPERCASE with type-level transformation.
 * Preserves the uppercase type at the type level.
 * @category Case Conversion
 * @param str - The string to convert
 * @returns The uppercase string with Uppercase<S> type
 * @example
 * ```typescript
 * uppercase('hello')  // Type: "HELLO" (not string)
 * uppercase('world')  // Type: "WORLD"
 *
 * // Works with plain strings too
 * uppercase('hello world') // 'HELLO WORLD'
 * uppercase('FooBar') // 'FOOBAR'
 * ```
 */
export const capAll = <$S extends string>(str: $S): Uppercase<$S> => {
  return str.toUpperCase() as Uppercase<$S>
}

/**
 * Convert the first letter of a string to lowercase with type-level transformation.
 * @category Case Conversion
 * @param s - The string to convert
 * @returns The string with lowercase first letter and Uncapitalize<S> type
 * @example
 * ```typescript
 * lowerCaseFirst('Hello')  // Type: "hello"
 * lowerCaseFirst('World')  // Type: "world"
 * lowerCaseFirst('HELLO')  // Type: "hELLO"
 * ```
 */
export const uncapFirst = <$S extends string>(s: $S): Uncapitalize<$S> => {
  return (s.charAt(0).toLowerCase() + s.slice(1)) as Uncapitalize<$S>
}

/**
 * Capitalize the first letter of a string with type-level transformation.
 * @category Case Conversion
 * @param string - The string to capitalize
 * @returns The string with capitalized first letter and Capitalize<S> type
 * @example
 * ```typescript
 * capitalizeFirst('hello')  // Type: "Hello"
 * capitalizeFirst('world')  // Type: "World"
 * capitalizeFirst('foo bar')  // Type: "Foo bar"
 * ```
 */
export const capFirst = <$S extends string>(string: $S): Capitalize<$S> => {
  return (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<$S>
}
