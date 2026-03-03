// @ts-expect-error Duplicate identifier
export * as CoreFn from './__.js'

/**
 * Shared core function primitives used to avoid circular dependencies.
 */
export namespace CoreFn {}
