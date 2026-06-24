/**
 * Path analyzer for filesystem locations.
 *
 * Provides runtime analysis of path strings to determine
 * if they represent files or directories, extract metadata, and parse components.
 *
 * @module
 */
// @ts-expect-error re-export and namespace anchor intentionally share the name `CodecString`
export * as CodecString from './__.js'

/**
 * Namespace anchor for {@link CodecString}.
 */
export namespace CodecString {}
