/**
 * Filesystem path namespace following Kit universal ADT pattern.
 *
 * **Data Exports:**
 * - `.Any` = Union of all members (the complete ADT)
 * - `.<Member>` = Individual ADT members (PascalCase: AbsFile, AbsDir, RelFile, RelDir)
 * - `.$<Group>` = Cross-cutting union groupings ($ prefix: $Abs, $Rel, $File, $Dir)
 *
 * **Operation Exports:**
 * - `.<op>` = Operations on Any (camelCase: up, isDescendantOf, etc.)
 * - `.$<Group>.<op>` = Group-specific operations (when needed)
 * - `.<Member>.<op>` = Member-specific operations (as static methods on classes)
 *
 * This pattern applies universally across all Kit ADTs.
 *
 * @example
 * ```ts
 * import { Path } from '@kitz/fs'
 *
 * // Data - Union of all members
 * type AnyPath = typeof Path.Any.Type
 *
 * // Data - Individual members
 * const file = Path.AbsFile.make({ path, file })
 *
 * // Data - Groupings
 * type AbsPath = typeof Path.$Abs.Type  // AbsFile | AbsDir
 * type FilePath = typeof Path.$File.Type  // AbsFile | RelFile
 *
 * // Operations on Any
 * const parent = Path.up(somePath)
 * const isRoot = Path.isRoot(somePath)
 * ```
 */
// @ts-expect-error Duplicate identifier
export * as Path from './__.js'

export type Path = typeof import('./Schema.js').Schema.Type

/**
 * Namespace anchor for {@link Path}.
 */
export namespace Path {}
