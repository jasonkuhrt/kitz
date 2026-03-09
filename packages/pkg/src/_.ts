// @ts-expect-error Duplicate identifier
export * as Pkg from './__.js'

/**
 * Namespace anchor for {@link Pkg}.
 */
export namespace Pkg {}
