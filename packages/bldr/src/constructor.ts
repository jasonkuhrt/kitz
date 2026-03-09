import { Obj } from '@kitz/core'
import { StateSymbol } from './state.js'
import type { State } from './state.js'

export { StateSymbol } from './state.js'

/**
 * Configuration for creating an immutable builder.
 *
 * @category Builder Configuration
 *
 * @typeParam $State - The state type tracked by the builder
 * @typeParam $Methods - The builder methods object type
 * @typeParam $Terminal - The terminal methods object type
 */
export interface Config<
  $State extends State,
  $Methods extends Methods<$State>,
  $Terminal extends Terminal<$State>,
> {
  /**
   * Initial state for the builder.
   */
  initial: $State

  /**
   * Builder methods that update state and return a new builder.
   * Each method receives the current state and returns either void (to continue chaining)
   * or a new state object.
   *
   * @example
   * ```ts
   * {
   *   setName: (state, name: string) => ({ ...state, name }),
   *   addItem: (state, item: string) => {
   *     return { ...state, items: [...state.items, item] }
   *   }
   * }
   * ```
   */
  methods: $Methods

  /**
   * Terminal methods that execute and return a final result (not a builder).
   * These end the builder chain.
   *
   * @example
   * ```ts
   * {
   *   build: (state) => state,
   *   execute: (state, args: string[]) => processCommand(state, args)
   * }
   * ```
   */
  terminal: $Terminal
}

/**
 * Builder methods type - functions that receive state and optional args, return new state or void.
 *
 * @category Builder Types
 */
export type Methods<$State extends State> = Record<
  string,
  (state: $State, ...args: any[]) => $State | void
>

/**
 * Terminal methods type - functions that receive state and optional args, return any result.
 *
 * @category Builder Types
 */
export type Terminal<$State extends State> = Record<string, (state: $State, ...args: any[]) => any>

/**
 * Infer builder type from configuration.
 *
 * @category Builder Types
 */
export type InferBuilder<
  $State extends State,
  $Methods extends Methods<$State>,
  $Terminal extends Terminal<$State>,
> = {
  /**
   * Symbol property exposing internal state (for nested builders).
   */
  [StateSymbol]: $State
} & {
  [K in keyof $Methods]: (
    ...args: $Methods[K] extends (state: $State, ...args: infer Args) => any ? Args : never
  ) => InferBuilder<$State, $Methods, $Terminal>
} & {
  [K in keyof $Terminal]: (
    ...args: $Terminal[K] extends (state: $State, ...args: infer Args) => any ? Args : never
  ) => $Terminal[K] extends (state: $State, ...args: any[]) => infer Return ? Return : never
}

/**
 * Create an immutable fluent builder.
 *
 * Returns a builder where each method call creates a new builder instance with updated state.
 * This enables true immutability - the original builder remains unchanged.
 *
 * @category Builder Factory
 *
 * @param config - Builder configuration with initial state, methods, and terminal methods
 * @returns A fluent builder instance
 *
 * @example
 * ```ts
 * interface MyState extends State {
 *   name: string
 *   items: string[]
 * }
 *
 * const builder = create({
 *   initial: { name: '', items: [] },
 *   methods: {
 *     setName: (state, name: string) => ({ ...state, name }),
 *     addItem: (state, item: string) => ({
 *       ...state,
 *       items: [...state.items, item]
 *     })
 *   },
 *   terminal: {
 *     build: (state) => state
 *   }
 * })
 *
 * const result = builder
 *   .setName('MyBuilder')
 *   .addItem('first')
 *   .addItem('second')
 *   .build()
 * ```
 *
 * @example
 * ```ts
 * // Builder with symbol-based state access (for nested builders)
 * const nested = create({
 *   initial: { value: 0 },
 *   methods: {
 *     increment: (state) => ({ ...state, value: state.value + 1 })
 *   },
 *   terminal: {
 *     done: (state) => state.value
 *   }
 * })
 *
 * // Access internal state via symbol
 * const state = nested.increment().increment()[StateSymbol]
 * ```
 */
export const create = <
  $State extends State,
  $Methods extends Methods<$State>,
  $Terminal extends Terminal<$State>,
>(
  config: Config<$State, $Methods, $Terminal>,
): InferBuilder<$State, $Methods, $Terminal> => {
  return create_(config, config.initial)
}

/**
 * Internal recursive builder creation function.
 * Creates a new builder instance with the given state.
 */
const create_ = <
  $State extends State,
  $Methods extends Methods<$State>,
  $Terminal extends Terminal<$State>,
>(
  config: Config<$State, $Methods, $Terminal>,
  state: $State,
): any => {
  // Build methods object - each method creates a new builder with updated state
  const methods = Obj.mapValues(config.methods, (method) => {
    return (...args: any[]) => {
      const result = method(state, ...args)
      // If method returns void, use current state; otherwise use returned state
      const newState = result === undefined ? state : result
      return create_(config, newState)
    }
  })

  // Build terminal methods object - these execute and return results
  const terminal = Obj.mapValues(config.terminal, (method) => {
    return (...args: any[]) => method(state, ...args)
  })

  // Create builder with state symbol, methods, and terminal methods
  const builder = {
    [StateSymbol as any]: state,
    ...methods,
    ...terminal,
  }

  return builder
}
