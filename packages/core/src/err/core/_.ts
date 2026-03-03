// @ts-expect-error Duplicate identifier
export * as CoreErr from './__.js'

/**
 * Shared core error primitives used to avoid circular dependencies.
 */
export namespace CoreErr {}
