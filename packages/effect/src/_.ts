/**
 * `@kitz/effect` — filesystem operations and a typed path ADT for the Effect ecosystem.
 *
 * Exposes two namespaces, named to match (and supersede) effect's own modules:
 * - `FileSystem` — higher-level filesystem operations layered over effect's
 *   `FileSystem` service.
 * - `Path` — a typed path ADT (`AbsFile` | `AbsDir` | `RelFile` | `RelDir`).
 *
 * `effect` is a peer dependency; import effect's own surface directly from `effect`.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { FileSystem, Path } from '@kitz/effect'
 *
 * const file = Path.AbsFile.fromString('/home/user/config.json')
 * const program = Effect.gen(function* () {
 *   const text = yield* FileSystem.readString(file)
 *   return text
 * })
 * ```
 *
 * @module
 */
// @ts-expect-error Duplicate identifier
export * as FileSystem from './__.js'

/**
 * Namespace anchor for {@link FileSystem}.
 */
export namespace FileSystem {}

export { Path } from './path/_.js'

export * as String from './string/_.js'
