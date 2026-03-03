// @ts-expect-error Duplicate identifier
export * as Name from './__.js'

/**
 * Namespace anchor for {@link Name}.
 */
export namespace Name {}
