// @ts-expect-error Duplicate identifier
export * as Overload from './__.js'
export type { Data, DataEmpty, Discriminant } from './Data.js'

/**
 * Namespace anchor for {@link Overload}.
 */
export namespace Overload {}
