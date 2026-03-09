import { Obj } from '@kitz/core'
/**
 * Create a mutable fluent builder.
 *
 * Returns a builder where methods mutate a shared data object.
 * This provides simpler syntax at the cost of immutability.
 *
 * @category Mutable Builder Factory
 *
 * @param parameters - Configuration with data object and builder methods
 * @returns A fluent builder instance with mutable state
 *
 * @example
 * ```ts
 * const builder = createMutable({
 *   data: { name: '', items: [] },
 *   builder: {
 *     setName: (name: string) => {
 *       builder.data.name = name
 *     },
 *     addItem: (item: string) => {
 *       builder.data.items.push(item)
 *     }
 *   }
 * })
 *
 * const result = builder
 *   .setName('MyBuilder')
 *   .addItem('first')
 *   .return()
 * ```
 */
export const createMutable = (parameters: {
  data: object
  builder: Record<string, (...args: any[]) => any>
}) => {
  const builderInputWrapped = Obj.mapValues(parameters.builder, (method) => {
    return (...args: any[]) => {
      const result = method(...args)
      if (result === undefined) return builderFinal
      return result
    }
  })
  const builderFinal = {
    data: parameters.data,
    return: () => parameters.data,
    ...builderInputWrapped,
  }
  return builderFinal
}
