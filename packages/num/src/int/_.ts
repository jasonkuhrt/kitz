// Export the namespace containing all Int operations
// @ts-expect-error Duplicate identifier
export * as Int from './__.js'

/**
 * Namespace anchor for {@link Int}.
 */
export namespace Int {}
