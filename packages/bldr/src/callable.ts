/**
 * Callable builder factories.
 *
 * Creates builders that are themselves functions, supporting:
 * - Direct calls: `builder('arg')`
 * - Template tags: `` builder`template ${value}` ``
 * - Methods: `builder.method(...)`
 * - Terminal: `builder.build()`
 *
 * @module
 */

import type { State, StateSymbol } from './state.js'
import { StateSymbol as StateSymbolValue } from './state.js'

// =============================================================================
// Immutable Callable Builder
// =============================================================================

/**
 * Configuration for an immutable callable builder.
 *
 * @typeParam $State - The state type tracked by the builder
 * @typeParam $CallArgs - Arguments for direct function calls
 * @typeParam $Methods - Builder methods object type
 * @typeParam $Terminal - Terminal methods object type
 */
export interface CallableConfig<
  $State extends State,
  $CallArgs extends unknown[],
  $Methods extends CallableMethods<$State>,
  $Terminal extends CallableTerminal<$State>,
> {
  /**
   * Initial state for the builder.
   */
  initial: $State

  /**
   * Handler for direct function calls: `builder(...args)`
   *
   * Receives current state and user arguments, returns new state or void.
   *
   * @example
   * ```ts
   * call: (state, code: string) => ({
   *   ...state,
   *   lines: [...state.lines, code]
   * })
   * ```
   */
  call: (state: $State, ...args: $CallArgs) => $State | void

  /**
   * Optional handler for template literal calls: `` builder`...` ``
   *
   * If not provided, template calls interpolate to a string and pass
   * to the `call` handler.
   *
   * @example
   * ```ts
   * templateTag: (state, strings, ...values) => {
   *   const result = strings.reduce((acc, s, i) =>
   *     acc + s + (values[i] ?? ''), '')
   *   return { ...state, lines: [...state.lines, result] }
   * }
   * ```
   */
  templateTag?: (state: $State, strings: TemplateStringsArray, ...values: unknown[]) => $State | void

  /**
   * Builder methods that update state and return a new builder.
   */
  methods: $Methods

  /**
   * Terminal methods that execute and return final results.
   */
  terminal: $Terminal
}

/**
 * Builder methods type for callable builders.
 */
export type CallableMethods<$State extends State> = Record<
  string,
  (state: $State, ...args: any[]) => $State | void
>

/**
 * Terminal methods type for callable builders.
 */
export type CallableTerminal<$State extends State> = Record<
  string,
  (state: $State, ...args: any[]) => any
>

/**
 * Infer the callable builder type from configuration.
 *
 * Produces a type that is both:
 * - A callable function (with template tag overload)
 * - An object with method properties
 */
export type InferCallableBuilder<
  $State extends State,
  $CallArgs extends unknown[],
  $Methods extends CallableMethods<$State>,
  $Terminal extends CallableTerminal<$State>,
> =
  // Call signatures
  & {
    /** Direct call signature. */
    (...args: $CallArgs): InferCallableBuilder<$State, $CallArgs, $Methods, $Terminal>
    /** Template literal tag signature. */
    (strings: TemplateStringsArray, ...values: unknown[]): InferCallableBuilder<$State, $CallArgs, $Methods, $Terminal>
  }
  // State access
  & { readonly [StateSymbol]: $State }
  // Chainable methods
  & {
    readonly [K in keyof $Methods]: (
      ...args: $Methods[K] extends (state: $State, ...args: infer __args__) => any ? __args__ : never
    ) => InferCallableBuilder<$State, $CallArgs, $Methods, $Terminal>
  }
  // Terminal methods
  & {
    readonly [K in keyof $Terminal]: (
      ...args: $Terminal[K] extends (state: $State, ...args: infer __args__) => any ? __args__ : never
    ) => $Terminal[K] extends (state: $State, ...args: any[]) => infer __return__ ? __return__ : never
  }

/**
 * Create an immutable callable builder.
 *
 * Returns a builder that is itself a function. Each call (direct or method)
 * creates a new builder instance with updated state.
 *
 * Can be called in two ways:
 * 1. With explicit state type (curried): `createCallable<MyState>()(config)`
 * 2. With inferred type: `createCallable(config)`
 *
 * @param config - Builder configuration
 * @returns A callable fluent builder instance
 *
 * @example
 * ```ts
 * interface CodeState extends State {
 *   lines: string[]
 * }
 *
 * // With explicit state type (curried, no cast needed):
 * const code = createCallable<CodeState>()({
 *   initial: { lines: [] },
 *   call: (state, line: string) => ({
 *     ...state,
 *     lines: [...state.lines, line]
 *   }),
 *   methods: { ... },
 *   terminal: { build: (state) => state.lines.join('\n') }
 * })
 *
 * // With inferred type (needs cast):
 * const code = createCallable({
 *   initial: { lines: [] } as CodeState,
 *   ...
 * })
 *
 * // Usage:
 * const result = code('const x = 1')
 *   .comment('important')
 *   `const y = 2`
 *   .build()
 * // => "const x = 1\n// important\nconst y = 2"
 * ```
 */
export function createCallable<$State extends State>(): <
  $CallArgs extends unknown[],
  $Methods extends CallableMethods<$State>,
  $Terminal extends CallableTerminal<$State>,
>(
  config: CallableConfig<$State, $CallArgs, $Methods, $Terminal>,
) => InferCallableBuilder<$State, $CallArgs, $Methods, $Terminal>

export function createCallable<
  $State extends State,
  $CallArgs extends unknown[],
  $Methods extends CallableMethods<$State>,
  $Terminal extends CallableTerminal<$State>,
>(
  config: CallableConfig<$State, $CallArgs, $Methods, $Terminal>,
): InferCallableBuilder<$State, $CallArgs, $Methods, $Terminal>

export function createCallable<$State extends State>(
  config?: CallableConfig<$State, any, any, any>,
): any {
  // Curried form: createCallable<State>()
  if (config === undefined) {
    return <
      $CallArgs extends unknown[],
      $Methods extends CallableMethods<$State>,
      $Terminal extends CallableTerminal<$State>,
    >(
      cfg: CallableConfig<$State, $CallArgs, $Methods, $Terminal>,
    ) => createCallableInternal(cfg, cfg.initial)
  }
  // Direct form: createCallable(config)
  return createCallableInternal(config, config.initial)
}

const createCallableInternal = <
  $State extends State,
  $CallArgs extends unknown[],
  $Methods extends CallableMethods<$State>,
  $Terminal extends CallableTerminal<$State>,
>(
  config: CallableConfig<$State, $CallArgs, $Methods, $Terminal>,
  state: $State,
): any => {
  // Create the callable function
  const callable = (...args: unknown[]) => {
    // Detect template tag call: first arg is TemplateStringsArray
    if (isTemplateStringsArray(args[0])) {
      const handler = config.templateTag ?? defaultTemplateHandler(config.call)
      const result = handler(state, args[0] as TemplateStringsArray, ...args.slice(1))
      return createCallableInternal(config, result ?? state)
    }
    // Regular call
    const result = config.call(state, ...(args as $CallArgs))
    return createCallableInternal(config, result ?? state)
  }

  // Attach state symbol
  Object.defineProperty(callable, StateSymbolValue, { value: state, enumerable: false })

  // Attach chainable methods
  for (const [name, method] of Object.entries(config.methods)) {
    Object.defineProperty(callable, name, {
      value: (...args: unknown[]) => {
        const result = method(state, ...args)
        return createCallableInternal(config, result ?? state)
      },
      enumerable: true,
    })
  }

  // Attach terminal methods
  for (const [name, method] of Object.entries(config.terminal)) {
    Object.defineProperty(callable, name, {
      value: (...args: unknown[]) => method(state, ...args),
      enumerable: true,
    })
  }

  return callable
}

// =============================================================================
// Mutable Callable Builder
// =============================================================================

/**
 * Configuration factory for mutable callable builders.
 *
 * The factory function receives the data object so methods can close over it.
 */
export type MutableCallableFactory<
  $Data extends object,
  $CallArgs extends unknown[],
  $Builder extends Record<string, (...args: any[]) => any>,
  $Terminal extends Record<string, (...args: any[]) => any>,
> = (data: $Data) => {
  /**
   * Handler for direct function calls.
   */
  call: (...args: $CallArgs) => void

  /**
   * Optional handler for template literal calls.
   */
  templateTag?: (strings: TemplateStringsArray, ...values: unknown[]) => void

  /**
   * Builder methods (void return = auto-chain).
   */
  builder: $Builder

  /**
   * Terminal methods (return final values).
   */
  terminal: $Terminal
}

/**
 * Infer the mutable callable builder type.
 */
export type InferMutableCallableBuilder<
  $Data extends object,
  $CallArgs extends unknown[],
  $Builder extends Record<string, (...args: any[]) => any>,
  $Terminal extends Record<string, (...args: any[]) => any>,
> =
  // Call signatures
  & {
    (...args: $CallArgs): InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal>
    (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal>
  }
  // Data access
  & { readonly data: $Data }
  // Builder methods (void -> chain, else return value)
  & {
    readonly [K in keyof $Builder]: (
      ...args: Parameters<$Builder[K]>
    ) => ReturnType<$Builder[K]> extends void ? InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal>
      : ReturnType<$Builder[K]>
  }
  // Terminal methods
  & { readonly [K in keyof $Terminal]: $Terminal[K] }

/**
 * Create a mutable callable builder.
 *
 * Uses a factory function pattern so methods can close over the shared data object.
 * Methods that return void automatically return the builder for chaining.
 *
 * Can be called in two ways:
 * 1. With explicit data type (curried): `createCallableMutable<{ lines: string[] }>()(initialData, factory)`
 * 2. With inferred type: `createCallableMutable(initialData, factory)`
 *
 * @example
 * ```ts
 * // With explicit data type (no cast needed):
 * const code = createCallableMutable<{ lines: string[] }>()({ lines: [] }, (data) => ({
 *   call: (line: string) => { data.lines.push(line) },
 *   builder: { ... },
 *   terminal: { build: () => data.lines.join('\n') },
 * }))
 *
 * // With inferred type (needs cast):
 * const code = createCallableMutable({ lines: [] as string[] }, (data) => ({
 *   call: (line: string) => { data.lines.push(line) },
 *   builder: { ... },
 *   terminal: { build: () => data.lines.join('\n') },
 * }))
 * ```
 */
export function createCallableMutable<$Data extends object>(): <
  $CallArgs extends unknown[],
  $Builder extends Record<string, (...args: any[]) => any>,
  $Terminal extends Record<string, (...args: any[]) => any>,
>(
  initialData: $Data,
  factory: MutableCallableFactory<$Data, $CallArgs, $Builder, $Terminal>,
) => InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal>

export function createCallableMutable<
  $Data extends object,
  $CallArgs extends unknown[],
  $Builder extends Record<string, (...args: any[]) => any>,
  $Terminal extends Record<string, (...args: any[]) => any>,
>(
  initialData: $Data,
  factory: MutableCallableFactory<$Data, $CallArgs, $Builder, $Terminal>,
): InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal>

export function createCallableMutable<$Data extends object>(
  initialData?: $Data,
  factory?: MutableCallableFactory<$Data, any, any, any>,
): any {
  // Curried form: createCallableMutable<Type>()
  if (initialData === undefined) {
    return <
      $CallArgs extends unknown[],
      $Builder extends Record<string, (...args: any[]) => any>,
      $Terminal extends Record<string, (...args: any[]) => any>,
    >(
      data: $Data,
      fact: MutableCallableFactory<$Data, $CallArgs, $Builder, $Terminal>,
    ) => createCallableMutableImpl(data, fact)
  }
  // Direct form: createCallableMutable(data, factory)
  return createCallableMutableImpl(initialData, factory!)
}

const createCallableMutableImpl = <
  $Data extends object,
  $CallArgs extends unknown[],
  $Builder extends Record<string, (...args: any[]) => any>,
  $Terminal extends Record<string, (...args: any[]) => any>,
>(
  initialData: $Data,
  factory: MutableCallableFactory<$Data, $CallArgs, $Builder, $Terminal>,
): InferMutableCallableBuilder<$Data, $CallArgs, $Builder, $Terminal> => {
  const data = initialData
  const config = factory(data)

  // Create the callable function
  const callable = (...args: unknown[]) => {
    if (isTemplateStringsArray(args[0])) {
      const handler = config.templateTag ?? defaultMutableTemplateHandler(config.call)
      handler(args[0] as TemplateStringsArray, ...args.slice(1))
    } else {
      config.call(...(args as $CallArgs))
    }
    return callable
  }

  // Attach data
  Object.defineProperty(callable, 'data', { value: data, enumerable: true })

  // Attach builder methods (auto-return callable for void methods)
  for (const [name, method] of Object.entries(config.builder)) {
    Object.defineProperty(callable, name, {
      value: (...args: unknown[]) => {
        const result = method(...args)
        return result === undefined ? callable : result
      },
      enumerable: true,
    })
  }

  // Attach terminal methods
  for (const [name, method] of Object.entries(config.terminal)) {
    Object.defineProperty(callable, name, {
      value: method,
      enumerable: true,
    })
  }

  return callable as any
}

// =============================================================================
// Helpers
// =============================================================================

const isTemplateStringsArray = (value: unknown): value is TemplateStringsArray => Array.isArray(value) && 'raw' in value

const defaultTemplateHandler = <$State extends State, $CallArgs extends unknown[]>(
  call: (state: $State, ...args: $CallArgs) => $State | void,
) => {
  return (state: $State, strings: TemplateStringsArray, ...values: unknown[]) => {
    const result = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '')
    // Pass interpolated string to call handler (assumes call takes single string arg)
    return (call as any)(state, result)
  }
}

const defaultMutableTemplateHandler = <$CallArgs extends unknown[]>(
  call: (...args: $CallArgs) => void,
) => {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const result = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '') // Pass interpolated string to call handler (assumes call takes single string arg)
    ;(call as any)(result)
  }
}

// =============================================================================
// Interface-Driven Builder (fromInterface)
// =============================================================================

/**
 * Extract the call signature arguments from a callable interface.
 * Excludes template literal signature.
 */
type ExtractCallArgs<$Builder> =
  // Try to extract non-template call signature
  $Builder extends { (...args: infer __args__): any } ? __args__ extends [TemplateStringsArray, ...unknown[]] ? never // This is template signature, skip
    : __args__
    : never

/**
 * Extract method keys that return void (chainable methods).
 */
type ChainableMethodKeys<$Builder> = {
  [K in keyof $Builder]: K extends string ? $Builder[K] extends (...args: any[]) => void ? K
    : never
    : never
}[keyof $Builder]

/**
 * Extract method keys that return non-void (terminal methods).
 */
type TerminalMethodKeys<$Builder> = {
  [K in keyof $Builder]: K extends string
    ? $Builder[K] extends (...args: any[]) => infer __r__ ? __r__ extends void ? never
      : K
    : never
    : never
}[keyof $Builder]

/**
 * The implementation object shape for fromInterface.
 * Flat structure: call + templateTag? + all methods.
 */
type FromInterfaceImpl<$Data, $Builder> =
  & {
    /**
     * Handler for direct calls.
     */
    call: (...args: ExtractCallArgs<$Builder>) => void

    /**
     * Optional handler for template literal calls.
     */
    templateTag?: (strings: TemplateStringsArray, ...values: unknown[]) => void
  }
  & {
    /**
     * Chainable methods (void return).
     */
    [K in ChainableMethodKeys<$Builder>]: $Builder[K] extends (...args: infer __args__) => void
      ? (...args: __args__) => void
      : never
  }
  & {
    /**
     * Terminal methods (non-void return).
     */
    [K in TerminalMethodKeys<$Builder>]: $Builder[K] extends (...args: infer __args__) => infer __r__
      ? (...args: __args__) => __r__
      : never
  }

/**
 * Create a mutable callable builder factory from an interface definition.
 *
 * This is the cleanest API for creating callable builders:
 * - Define your `Builder` interface (public API)
 * - Implementation types are inferred from the interface
 * - No type duplication, no casts needed
 *
 * Distinguishes methods by return type:
 * - `void` return → chainable method (returns builder)
 * - Non-`void` return → terminal method (returns value)
 *
 * @example
 * ```ts
 * interface Data {
 *   lines: string[]
 * }
 * const dataEmpty: Data = { lines: [] }
 *
 * interface Builder {
 *   (code: string): void
 *   (strings: TemplateStringsArray, ...values: unknown[]): void
 *   interface(options: InterfaceOptions): void
 *   type(options: TypeOptions): void
 *   build(): string
 * }
 *
 * // Types flow from Builder - no duplication!
 * export const builder = fromInterface<Builder>()(dataEmpty, (data) => ({
 *   call: (code) => { data.lines.push(code) },
 *   templateTag: (strings, ...values) => { ... },
 *   interface: (options) => { data.lines.push(genInterface(options)) },
 *   type: (options) => { data.lines.push(genType(options)) },
 *   build: () => data.lines.join('\n')
 * }))
 *
 * // builder: () => Builder
 * const b = builder()
 * b.interface({ name: 'Foo' })
 * b.build() // => "interface Foo { }"
 * ```
 */
export const fromInterface = <$Builder>() => {
  return <$Data extends object>(
    emptyData: $Data,
    impl: (data: $Data) => FromInterfaceImpl<$Data, $Builder>,
  ): () => $Builder => {
    // Return a factory that creates fresh builder instances
    return () => {
      // Copy emptyData for each instance
      const data = { ...emptyData }
      const config = impl(data)

      // Create the callable function
      const callable = (...args: unknown[]) => {
        if (isTemplateStringsArray(args[0])) {
          const handler = config.templateTag ?? ((strings: TemplateStringsArray, ...vals: unknown[]) => {
            const result = strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '')
            ;(config.call as any)(result)
          })
          handler(args[0] as TemplateStringsArray, ...args.slice(1))
        } else {
          ;(config.call as any)(...args)
        }
        return callable
      }

      // Attach all methods from config (excluding call/templateTag)
      for (const [name, method] of Object.entries(config)) {
        if (name === 'call' || name === 'templateTag') continue
        Object.defineProperty(callable, name, {
          value: (...args: unknown[]) => {
            const result = (method as any)(...args)
            // void return → chainable, else terminal
            return result === undefined ? callable : result
          },
          enumerable: true,
        })
      }

      return callable as $Builder
    }
  }
}
