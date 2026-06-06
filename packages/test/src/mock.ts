/**
 * Generic Effect-service mock driver.
 *
 * `Mock.make(tag)` builds a mutable test double for any `Context.Service` whose
 * methods return `Effect`s. The returned driver mirrors the service's method
 * tree; each method is callable (acting as the mocked service method) and also
 * carries a per-method control + inspection surface (`next`, `every`,
 * `nextSuccess`, `everySuccess`, `nextFail`, `everyFail`, `when`, `calls`,
 * `clear`, `reset`). The `$test` property exposes driver-wide controls:
 * `layer()` to wire the mock into an Effect program, plus `clearCalls()`,
 * `reset()`, and `override()`.
 *
 * Resolution precedence per call: a matching `when(...)` branch's queued `next`
 * → that branch's `every` → the global `next` FIFO → the global `every`
 * fallback → otherwise the call dies with an unimplemented-mock error.
 *
 * The driver is the generic core of the Prisma test driver with the
 * Prisma-specific delegate taxonomy removed; it works on flat services (every
 * method directly on the service) and nested services (methods grouped under
 * sub-objects) alike.
 *
 * @example
 * ```ts
 * const git = Mock.make(Git)
 * git.getTags.nextSuccess(['v1.0.0'])
 * const layer = git.$test.layer()
 * ```
 *
 * @category Mocking
 */

import { Context, Effect, Layer, Match, Option } from 'effect'

type AnyEffect = Effect.Effect<any, any, any>
type AnyEffectMethod = (...args: ReadonlyArray<any>) => AnyEffect

// ─── Public type surface ────────────────────────────────────────────────────

/**
 * Recursive partial used for `when(...)` argument matching.
 *
 * @example
 * ```ts
 * type Match = Mock.DeepPartial<{ where: { id: string } }>
 * ```
 *
 * @category Mocking
 */
export type DeepPartial<TValue> = TValue extends (...args: ReadonlyArray<any>) => any
  ? TValue
  : TValue extends ReadonlyArray<infer TItem>
    ? ReadonlyArray<DeepPartial<TItem>>
    : TValue extends object
      ? { readonly [TKey in keyof TValue]?: DeepPartial<TValue[TKey]> }
      : TValue

/**
 * Normalize a method's parameter tuple to the shape the controls observe:
 * zero params → `undefined`, one param → that param, multiple params → the
 * tuple.
 */
/** Distribute a head prepend over a union of tuple tails. */
type Prepend<THead, TTail extends ReadonlyArray<any>> = TTail extends TTail
  ? readonly [THead, ...TTail]
  : never

/** Drop the leading element of a tuple, preserving the tail's optionality. */
type Tail<TArgs extends ReadonlyArray<any>> = TArgs extends readonly [any?, ...infer TRest]
  ? TRest
  : []

/**
 * Enumerate every concrete argument array a parameter tuple can be called
 * with — one tuple per optional prefix from the required arity up to the full
 * arity. `[a, b?]` yields `[a] | [a, b]`.
 */
type ValidCalls<TArgs extends ReadonlyArray<any>> =
  Required<TArgs> extends readonly [infer THead, ...any[]]
    ?
        | ([] extends TArgs ? readonly [] : never)
        | (Required<Tail<TArgs>> extends readonly [any, ...any[]]
            ? Prepend<THead, ValidCalls<Tail<TArgs>>>
            : readonly [THead])
    : readonly []

/**
 * Map one concrete argument arity to the shape `normalizeArgs` records: `[]` →
 * `undefined`, `[a]` → `a`, `[a, b, ...]` → the tuple.
 */
type NormalizeArity<TArgs extends ReadonlyArray<any>> = TArgs extends readonly []
  ? undefined
  : TArgs extends readonly [any]
    ? TArgs[0]
    : TArgs

/**
 * Normalize a method's parameter tuple to the union of shapes the controls
 * observe across every callable arity. A variadic tuple keeps its full shape.
 */
type NormalizeInput<TArgs extends ReadonlyArray<any>> = number extends TArgs['length']
  ? TArgs
  : ValidCalls<TArgs> extends infer TCall
    ? TCall extends ReadonlyArray<any>
      ? NormalizeArity<TCall>
      : never
    : never

type HasEffectCallableDescendant<TValue> =
  TValue extends ReadonlyArray<any>
    ? false
    : TValue extends AnyEffectMethod
      ? true
      : TValue extends object
        ? true extends {
            readonly [TKey in keyof TValue]: HasEffectCallableDescendant<TValue[TKey]>
          }[keyof TValue]
          ? true
          : false
        : false

type MockCall<TArgs extends ReadonlyArray<any>> = readonly [NormalizeInput<TArgs>]

type MockImplementation<TArgs extends ReadonlyArray<any>, TReturn extends AnyEffect> = (
  args: NormalizeInput<TArgs>,
) => TReturn

type MockInspection<TArgs extends ReadonlyArray<any>> = {
  readonly calls: ReadonlyArray<MockCall<TArgs>>
  clear(): void
  reset(): void
}

/**
 * Option-shaped controls, present only when the method's success channel is an
 * `Option`. Lets callers script the some/none cases without re-wrapping.
 */
type OptionHelpers<TSuccess> =
  TSuccess extends Option.Option<infer TSome>
    ? {
        nextSome(value: TSome): void
        everySome(value: TSome): void
        nextNone(): void
        everyNone(): void
      }
    : {}

type BaseMockConfigurer<TArgs extends ReadonlyArray<any>, TReturn extends AnyEffect, TSuccess> = {
  next(fn: MockImplementation<TArgs, TReturn>): void
  every(fn: MockImplementation<TArgs, TReturn>): void
  nextSuccess(value: TSuccess): void
  everySuccess(value: TSuccess): void
  nextFail(error: Effect.Error<TReturn>): void
  everyFail(error: Effect.Error<TReturn>): void
} & OptionHelpers<TSuccess>

type MockConfigurer<
  TArgs extends ReadonlyArray<any>,
  TReturn extends AnyEffect,
> = BaseMockConfigurer<TArgs, TReturn, Effect.Success<TReturn>> & {
  when(partialArgs: DeepPartial<NormalizeInput<TArgs>>): MockConfigurer<TArgs, TReturn>
}

/**
 * Controls and inspection surface attached to one mocked Effect-returning
 * method.
 *
 * @example
 * ```ts
 * git.getTags.nextSuccess(['v1.0.0'])
 * git.getTags.calls // ReadonlyArray<[undefined]>
 * ```
 *
 * @category Mocking
 */
export type MockOp<
  TArgs extends ReadonlyArray<any>,
  TReturn extends AnyEffect,
> = MockInspection<TArgs> & MockConfigurer<TArgs, TReturn>

type MockMethod<TMethod extends AnyEffectMethod> = TMethod &
  MockOp<Extract<Parameters<TMethod>, ReadonlyArray<any>>, ReturnType<TMethod>>

type DriverValue<TValue> = TValue extends AnyEffectMethod
  ? MockMethod<Extract<TValue, AnyEffectMethod>>
  : TValue extends ReadonlyArray<any>
    ? TValue
    : TValue extends object
      ? HasEffectCallableDescendant<TValue> extends true
        ? DriverObject<TValue>
        : TValue
      : TValue

type DriverObject<TObject extends object> = {
  readonly [TKey in keyof TObject]: DriverValue<TObject[TKey]>
}

/**
 * Deep mock facade matching a caller-owned context service.
 *
 * @example
 * ```ts
 * const git = Mock.make(Git)
 * ```
 *
 * @category Mocking
 */
export type Driver<TService extends Context.Service.Any> = DriverObject<
  Context.Service.Shape<TService>
> & {
  readonly $test: Controls<TService>
}

/**
 * Partial service override shape accepted by `driver.$test.override(...)`.
 *
 * Synchronous (non-Effect) fields can be pinned; method positions are dropped
 * from the accepted shape because methods are controlled via `next`/`every`.
 *
 * @category Mocking
 */
export type Override<TValue> = TValue extends (...args: ReadonlyArray<any>) => any
  ? never
  : TValue extends ReadonlyArray<infer TItem>
    ? ReadonlyArray<Override<TItem>>
    : TValue extends object
      ? { readonly [TKey in keyof TValue]?: Override<TValue[TKey]> }
      : TValue

/**
 * Driver-wide mutable test controls for one `Mock.make(service)` driver.
 *
 * @category Mocking
 */
export type Controls<TService extends Context.Service.Any> = {
  /**
   * Build the `Layer` that provides this mock as the service for `TService`.
   * Call at the edge of the test (`Effect.provide(driver.$test.layer())`); each
   * `Mock.make(service)` owns its own layer instance.
   */
  layer(): Layer.Layer<Context.Service.Identifier<TService>>
  /**
   * Clear the recorded call log on every method controller without discarding
   * queued implementations or overrides.
   */
  clearCalls(): void
  /**
   * Drop all queued implementations, recorded calls, branches, and overrides,
   * returning the driver to its freshly-made state.
   */
  reset(): void
  /**
   * Merge a partial service shape on top of the mock's resolution chain so
   * subsequent property reads return the overridden synchronous values.
   */
  override(partial: Override<Context.Service.Shape<TService>>): void
}

// ─── Runtime state ──────────────────────────────────────────────────────────

type RuntimeImplementation = (args: unknown) => AnyEffect
type RuntimeBranch = {
  readonly matcher: (args: unknown) => boolean
  readonly queue: Array<RuntimeImplementation>
  every: RuntimeImplementation | undefined
}
type RuntimeController = {
  readonly calls: Array<readonly [unknown]>
  readonly queue: Array<RuntimeImplementation>
  every: RuntimeImplementation | undefined
  readonly branches: Array<RuntimeBranch>
}
type RuntimeState = {
  readonly serviceKey: Context.Service.Any
  readonly controllers: Map<string, RuntimeController>
  readonly proxyCache: Map<string, unknown>
  service: unknown
  controls: Controls<Context.Service.Any>
  overrides: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHiddenStringProperty(prop: string, isRoot: boolean): boolean {
  if (isRoot && prop === '$test') {
    return false
  }
  return prop.startsWith('$') || prop.startsWith('_')
}

function createController(): RuntimeController {
  return { calls: [], queue: [], every: undefined, branches: [] }
}

function getController(state: RuntimeState, path: string): RuntimeController {
  const existing = state.controllers.get(path)
  if (existing !== undefined) {
    return existing
  }
  const controller = createController()
  state.controllers.set(path, controller)
  return controller
}

function normalizeArgs(args: ReadonlyArray<unknown>): unknown {
  return Match.value(args.length).pipe(
    Match.when(0, () => undefined),
    Match.when(1, () => args[0]),
    Match.orElse(() => args),
  )
}

function makeUnimplementedError(message: string): Error {
  const error = new Error(message)
  error.name = 'UnimplementedError'
  return error
}

function missingMock(path: string): AnyEffect {
  return Effect.die(makeUnimplementedError(`Missing Mock implementation for ${path}`))
}

function isPlainObjectForMerge(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function mergeOverride(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (isPlainObjectForMerge(existing) && isPlainObjectForMerge(value)) {
      mergeOverride(existing, value)
      continue
    }
    target[key] = isPlainObjectForMerge(value) ? mergeOverride({}, value) : value
  }
  return target
}

function lookupOverride(
  root: Record<string, unknown>,
  path: ReadonlyArray<string>,
): { readonly found: boolean; readonly value?: unknown } {
  let current: unknown = root
  for (const segment of path) {
    if (!isRecord(current) || !Reflect.has(current, segment)) {
      return { found: false }
    }
    current = current[segment]
  }
  return { found: true, value: current }
}

function shouldProxyOverrideObject(value: Record<string, unknown>): boolean {
  return Object.values(value).some(
    (child) => typeof child === 'function' || (isRecord(child) && !Array.isArray(child)),
  )
}

function createOverrideProxy(state: RuntimeState, path: ReadonlyArray<string>): unknown {
  const cacheKey = `override:${path.join('.')}`
  const cached = state.proxyCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const currentOverride = lookupOverride(state.overrides, path)
  const target =
    currentOverride.found && isRecord(currentOverride.value) ? currentOverride.value : {}

  const proxy = new Proxy(target, {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined
      }
      if (prop === Symbol.toStringTag) {
        return 'Mock.Override'
      }
      if (typeof prop !== 'string') {
        return undefined
      }

      const override = lookupOverride(state.overrides, path)
      if (!override.found || !isRecord(override.value)) {
        return Reflect.get(createDriverProxy(state, path) as object, prop)
      }

      if (Reflect.has(override.value, prop)) {
        const value = override.value[prop]
        if (isRecord(value) && !Array.isArray(value)) {
          return shouldProxyOverrideObject(value)
            ? createOverrideProxy(state, [...path, prop])
            : value
        }
        return value
      }

      return createDriverProxy(state, [...path, prop])
    },
    has(_target, prop) {
      if (typeof prop !== 'string') {
        return false
      }
      const override = lookupOverride(state.overrides, path)
      return (
        (override.found && isRecord(override.value) && Reflect.has(override.value, prop)) ||
        Reflect.has(createDriverProxy(state, path) as object, prop)
      )
    },
    ownKeys() {
      const override = lookupOverride(state.overrides, path)
      return override.found && isRecord(override.value) ? Reflect.ownKeys(override.value) : []
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string') {
        return undefined
      }
      const override = lookupOverride(state.overrides, path)
      if (!override.found || !isRecord(override.value)) {
        return undefined
      }
      if (!Reflect.has(override.value, prop)) {
        return undefined
      }
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: override.value[prop],
      }
    },
  })

  state.proxyCache.set(cacheKey, proxy)
  return proxy
}

function clearOverrideProxyCache(state: RuntimeState) {
  for (const key of [...state.proxyCache.keys()]) {
    if (key.startsWith('override:')) {
      state.proxyCache.delete(key)
    }
  }
}

function isDeepPartialMatch(expected: unknown, actual: unknown): boolean {
  if (Object.is(expected, actual)) {
    return true
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) {
      return false
    }
    return expected.every((value, index) => isDeepPartialMatch(value, actual[index]))
  }
  if (!isPlainObjectForMerge(expected)) {
    return false
  }
  if (!isRecord(actual)) {
    return false
  }
  return Object.entries(expected).every(([key, value]) => isDeepPartialMatch(value, actual[key]))
}

function clearControllerCalls(controller: RuntimeController) {
  controller.calls.length = 0
}

function resetController(controller: RuntimeController) {
  clearControllerCalls(controller)
  controller.queue.length = 0
  controller.every = undefined
  controller.branches.length = 0
}

function resolveImplementation(
  controller: RuntimeController,
  args: unknown,
): RuntimeImplementation | undefined {
  for (const branch of controller.branches) {
    if (!branch.matcher(args)) {
      continue
    }
    const branchNext = branch.queue.shift()
    if (branchNext !== undefined) {
      return branchNext
    }
    if (branch.every !== undefined) {
      return branch.every
    }
  }
  const next = controller.queue.shift()
  if (next !== undefined) {
    return next
  }
  return controller.every
}

function successImplementation(value: unknown): RuntimeImplementation {
  return () => Effect.succeed(value)
}

function failImplementation(error: unknown): RuntimeImplementation {
  return () => Effect.fail(error)
}

function someImplementation(value: unknown): RuntimeImplementation {
  return () => Effect.succeed(Option.some(value))
}

function noneImplementation(): RuntimeImplementation {
  return () => Effect.succeed(Option.none())
}

function createRuntimeBranchConfigurer(
  controller: RuntimeController,
  branch: RuntimeBranch,
): Record<string, unknown> {
  return {
    next(fn: RuntimeImplementation) {
      branch.queue.push(fn)
    },
    every(fn: RuntimeImplementation) {
      branch.every = fn
    },
    nextSuccess(value: unknown) {
      branch.queue.push(successImplementation(value))
    },
    everySuccess(value: unknown) {
      branch.every = successImplementation(value)
    },
    nextFail(error: unknown) {
      branch.queue.push(failImplementation(error))
    },
    everyFail(error: unknown) {
      branch.every = failImplementation(error)
    },
    nextSome(value: unknown) {
      branch.queue.push(someImplementation(value))
    },
    everySome(value: unknown) {
      branch.every = someImplementation(value)
    },
    nextNone() {
      branch.queue.push(noneImplementation())
    },
    everyNone() {
      branch.every = noneImplementation()
    },
    when(partialArgs: unknown) {
      const nestedBranch = {
        matcher: (args: unknown) => isDeepPartialMatch(partialArgs, args),
        queue: [],
        every: undefined,
      } satisfies RuntimeBranch
      controller.branches.push(nestedBranch)
      return createRuntimeBranchConfigurer(controller, nestedBranch)
    },
  }
}

const controllerOwnKeys = [
  'calls',
  'clear',
  'reset',
  'next',
  'every',
  'nextSuccess',
  'everySuccess',
  'nextFail',
  'everyFail',
  'nextSome',
  'everySome',
  'nextNone',
  'everyNone',
  'when',
] as const

function createRuntimeControllerFacade(controller: RuntimeController): Record<string, unknown> {
  const globalBranch = {
    matcher: () => true,
    queue: controller.queue,
    get every() {
      return controller.every
    },
    set every(value: RuntimeImplementation | undefined) {
      controller.every = value
    },
  } as RuntimeBranch

  return {
    get calls() {
      return controller.calls
    },
    clear() {
      clearControllerCalls(controller)
    },
    reset() {
      resetController(controller)
    },
    ...createRuntimeBranchConfigurer(controller, globalBranch),
  }
}

function createDriverProxy(state: RuntimeState, path: ReadonlyArray<string>): unknown {
  const cacheKey = path.join('.')
  const cached = state.proxyCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  // oxlint-disable-next-line eslint/prefer-arrow-callback -- named function expression supplies proxy.name (callable Proxy target) used in error messages and runtime identification
  const proxy = new Proxy(function mockServiceMethod() {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined
      }
      if (prop === Symbol.toStringTag) {
        return 'Mock'
      }
      if (typeof prop !== 'string') {
        return undefined
      }

      if (path.length === 0 && prop === '$test') {
        return state.controls
      }

      if (isHiddenStringProperty(prop, path.length === 0)) {
        return undefined
      }

      if (path.length > 0) {
        const controller = createRuntimeControllerFacade(getController(state, cacheKey))
        if (Reflect.has(controller, prop)) {
          return controller[prop]
        }
      }

      const childPath = [...path, prop]
      const override = lookupOverride(state.overrides, childPath)
      if (override.found) {
        if (isRecord(override.value) && !Array.isArray(override.value)) {
          return shouldProxyOverrideObject(override.value)
            ? createOverrideProxy(state, childPath)
            : override.value
        }
        return override.value
      }

      return createDriverProxy(state, childPath)
    },
    apply(_target, _thisArg, args) {
      if (path.length === 0) {
        return missingMock('<root>')
      }

      const override = lookupOverride(state.overrides, path)
      if (override.found && typeof override.value === 'function') {
        return (override.value as (...args: ReadonlyArray<unknown>) => unknown)(...args)
      }

      const pathKey = path.join('.')
      const normalizedArgs = normalizeArgs(args)
      const controller = getController(state, pathKey)
      controller.calls.push([normalizedArgs] as const)

      const implementation = resolveImplementation(controller, normalizedArgs)
      if (implementation === undefined) {
        return missingMock(pathKey)
      }
      return implementation(normalizedArgs)
    },
    has(_target, prop) {
      if (typeof prop !== 'string') {
        return false
      }
      if (path.length === 0 && prop === '$test') {
        return true
      }
      if (isHiddenStringProperty(prop, path.length === 0)) {
        return false
      }
      if (path.length > 0) {
        const controller = createRuntimeControllerFacade(getController(state, cacheKey))
        if (Reflect.has(controller, prop)) {
          return true
        }
      }
      return true
    },
    ownKeys() {
      if (path.length === 0) {
        return ['$test']
      }
      return [...controllerOwnKeys]
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string') {
        return undefined
      }
      if (path.length === 0 && prop === '$test') {
        return { configurable: true, enumerable: false, writable: false, value: undefined }
      }
      if (isHiddenStringProperty(prop, path.length === 0)) {
        return undefined
      }
      if (path.length > 0) {
        const controller = createRuntimeControllerFacade(getController(state, cacheKey))
        if (Reflect.has(controller, prop)) {
          return {
            configurable: true,
            enumerable: false,
            writable: false,
            value: controller[prop],
          }
        }
      }
      return { configurable: true, enumerable: true, writable: false, value: undefined }
    },
  })

  state.proxyCache.set(cacheKey, proxy)
  return proxy
}

/**
 * Create a mutable mock driver for an Effect context service.
 *
 * @param serviceKey The caller-owned service whose shape should be mocked.
 *
 * @example
 * ```ts
 * const git = Mock.make(Git)
 * git.getTags.nextSuccess(['v1.0.0'])
 * Effect.provide(program, git.$test.layer())
 * ```
 *
 * @category Mocking
 */
export function make<TService extends Context.Service.Any>(serviceKey: TService): Driver<TService> {
  const state: RuntimeState = {
    serviceKey,
    controllers: new Map<string, RuntimeController>(),
    proxyCache: new Map<string, unknown>(),
    service: undefined,
    controls: undefined as unknown as Controls<Context.Service.Any>,
    overrides: {},
  }

  const service = createDriverProxy(state, [])
  state.service = service
  state.controls = {
    layer: () => Layer.succeed(serviceKey, service as Context.Service.Shape<TService>),
    clearCalls: () => {
      for (const controller of state.controllers.values()) {
        clearControllerCalls(controller)
      }
    },
    reset: () => {
      for (const controller of state.controllers.values()) {
        resetController(controller)
      }
      state.overrides = {}
      clearOverrideProxyCache(state)
    },
    override: (partial) => {
      mergeOverride(state.overrides, partial as unknown as Record<string, unknown>)
      clearOverrideProxyCache(state)
    },
  } as Controls<Context.Service.Any>

  return service as Driver<TService>
}
