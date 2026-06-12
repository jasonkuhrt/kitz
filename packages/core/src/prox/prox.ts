export interface GetProxyOptions {
  symbols?: boolean
}

/* oxlint-disable typescript/no-unnecessary-type-parameters -- `type` is an explicit type-argument injection point: the caller supplies the proxy's surface type. */
export const createCachedGetProxy = <type, options extends GetProxyOptions>(
  createValue: (
    propertyName: options['symbols'] extends true ? symbol | string : string,
  ) => Function,
  options?: options,
): type => {
  const cache = new Map<symbol | string, any>()
  const config = {
    symbols: options?.symbols ?? false,
  }

  return new Proxy({} as any, {
    get(target, propertyName) {
      if (!config.symbols && typeof propertyName !== 'string') {
        return undefined
      }

      // Check if property exists on the target (e.g., $ property)
      if (propertyName in target) {
        return target[propertyName]
      }

      let cachedMethod = cache.get(propertyName)
      if (cachedMethod) return cachedMethod

      const value = createValue(propertyName as any)
      cache.set(propertyName, value)

      return value
    },
  })
}
/* oxlint-enable typescript/no-unnecessary-type-parameters */

/**
 * Creates an infinite self-referencing proxy.
 *
 * Every property access returns the same proxy, allowing unlimited chaining.
 * Useful for type-level APIs where the runtime behavior doesn't matter.
 *
 * @template $Type - The type signature to enforce on the proxy
 *
 * @example
 * ```typescript
 * interface Builder {
 *   exact: Builder
 *   equiv: Builder
 *   of: <T>() => (value: T) => void
 * }
 *
 * const builder = Prox.createRecursive<Builder>()
 * builder.exact.equiv.of<string>()('hello')  // All properties return the proxy
 * ```
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- `$Type` is an explicit type-argument injection point: the caller supplies the proxy's surface type.
export const createRecursive = <$Type>(): $Type => {
  const proxy: any = new Proxy(() => {}, {
    get: () => proxy,
    apply: () => proxy,
  })
  return proxy
}
