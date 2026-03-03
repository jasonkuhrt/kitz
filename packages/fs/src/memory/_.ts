/**
 * Memory-based filesystem implementation for Effect Platform.
 *
 * Provides an in-memory filesystem service that implements the Effect Platform
 * FileSystem interface. Useful for testing code that depends on filesystem
 * operations without actually touching the disk.
 *
 * @module
 */

// @ts-expect-error Duplicate identifier
export * as Memory from './__.js'

/**
 * Namespace anchor for {@link Memory}.
 */
export namespace Memory {}
