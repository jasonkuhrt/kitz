// Export the namespace containing all Even operations
// @ts-expect-error Duplicate identifier
export * as Even from './__.js'

/**
 * Namespace anchor for {@link Even}.
 */
export namespace Even {}
