// @ts-expect-error Duplicate identifier
export * as CoreLang from './__.js'

/**
 * Shared core language primitives used to avoid circular dependencies.
 */
export namespace CoreLang {}
