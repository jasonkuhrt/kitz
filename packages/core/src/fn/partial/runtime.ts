import type { Fn } from '#fn'

/**
 * Symbol used to represent a hole in partial application.
 * When used as an argument, indicates that the parameter should be deferred.
 *
 * @category Partial Application
 * @example
 * ```ts
 * const add = (a: number, b: number) => a + b
 * const addOne = partial(add, _, 1) // (a: number) => number
 * addOne(5) // 6
 * ```
 */
export const _ = Symbol.for('kit.partial.hole')

/**
 * @category Partial Application
 */
export type _ = typeof _

/**
 * Type guard to check if a value is a hole.
 *
 * @category Partial Application
 */
export const isHole = (value: unknown): value is _ => value === _

/**
 * Create a partially applied function by providing some arguments upfront.
 * Use the hole symbol (_) to defer parameters.
 *
 * @category Partial Application
 * @param fn - The function to partially apply
 * @param args - Arguments with holes (_) for deferred parameters
 * @returns A new function accepting the remaining arguments, or the result if all arguments are provided
 *
 * @example
 * ```ts
 * // Basic usage
 * const add = (a: number, b: number) => a + b
 * const addOne = partial(add, _, 1)
 * addOne(5) // 6
 *
 * // Multiple holes
 * const greet = (greeting: string, name: string, punctuation: string) =>
 *   `${greeting}, ${name}${punctuation}`
 * const casualGreet = partial(greet, 'Hey', _, '!')
 * casualGreet('Alice') // 'Hey, Alice!'
 *
 * // All arguments provided - executes immediately
 * const result = partial(add, 1, 2) // 3
 * ```
 */
export const partial = <$Fn extends Fn.AnyAny, const $Args extends readonly unknown[]>(
  fn: $Fn,
  ...args: $Args
): any => {
  // Count holes to determine if we should execute or return a function
  const holeCount = args.filter(isHole).length

  if (holeCount === 0) {
    // No holes - execute immediately
    return fn(...args) as any
  }

  // Return a function that accepts the remaining arguments
  return ((...remainingArgs: unknown[]) => {
    const filledArgs: unknown[] = []
    let remainingIndex = 0

    for (const arg of args) {
      if (isHole(arg)) {
        filledArgs.push(remainingArgs[remainingIndex])
        remainingIndex++
      } else {
        filledArgs.push(arg)
      }
    }

    return fn(...filledArgs)
  }) as any
}

/**
 * Type-safe partial application with automatic type inference.
 * This is an alias for `partial` with a more explicit name.
 *
 * @category Partial Application
 * @example
 * ```ts
 * const multiply = (a: number, b: number, c: number) => a * b * c
 * const double = apply(multiply, 2, _, 1)
 * double(5) // 10
 * ```
 */
export const apply = partial

/**
 * Helper to create a deferred computation using partial application.
 * Useful for creating thunks or delayed evaluations.
 *
 * @category Partial Application
 * @example
 * ```ts
 * const expensiveComputation = (a: number, b: number) => {
 *   console.log('Computing...')
 *   return a * b
 * }
 *
 * const deferred = defer(expensiveComputation, 5, 10)
 * // Nothing logged yet
 *
 * const result = deferred() // Logs: 'Computing...'
 * // result: 50
 * ```
 */
export const defer = <$Fn extends Fn.AnyAny>(
  fn: $Fn,
  ...args: Parameters<$Fn>
): (() => ReturnType<$Fn>) => {
  return () => fn(...args)
}

/**
 * Check if a value is potentially a partially applicable argument
 * (either a hole or a regular value).
 *
 * @category Partial Application
 */
export const isPartialArg = (_value: unknown): boolean => true
