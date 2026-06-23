/**
 * Filesystem path namespace following the Kit universal ADT pattern.
 *
 * **Data Exports:**
 * - `.Schema` = union of all members (the complete ADT)
 * - `.<Member>` = individual ADT members (PascalCase: `AbsFile`, `AbsDir`, `RelFile`,
 *   `RelDir`). Each binding **is** the member's string codec — usable directly as a
 *   schema (`S.Struct({ p: Path.AbsFile })`) — and carries `make`/`fromString`/`is`
 *   as statics. Decoded values are class instances with `.name` and `.toString()`.
 * - `.$<Group>` = cross-cutting union groupings ($ prefix: `$Abs`, `$Rel`, `$File`,
 *   `$Dir`), each also a codec with an `is` static.
 *
 * **Operation Exports:**
 * - `.<op>` = operations on any path (camelCase: `up`, `isDescendantOf`, etc.)
 * - `.<Member>.<op>` = member-specific constructors/guards (static methods)
 *
 * This pattern applies universally across all Kit ADTs.
 *
 * @example
 * ```ts
 * import { Schema as S } from 'effect'
 * import { Path } from '@kitz/effect'
 *
 * // Data - union of all members
 * type AnyPath = Path
 *
 * // Data - individual members (codecs + constructors)
 * const file = Path.AbsFile.fromString('/home/user/config.json')
 *
 * // Data - groupings
 * type AbsPath = typeof Path.$Abs.Type   // AbsFile | AbsDir
 * type FilePath = typeof Path.$File.Type // AbsFile | RelFile
 *
 * // Use any member/group directly as a schema (no `.Schema` hop)
 * const Config = S.Struct({ source: Path.AbsFile, out: Path.$Dir })
 *
 * // Operations on any path
 * const parent = Path.up(file)
 * const isRoot = Path.isRoot(file)
 * ```
 */
// @ts-expect-error Duplicate identifier
export * as Path from './__.js'

export type Path = typeof import('./Schema.js').Schema.Type

/**
 * Namespace anchor for {@link Path}.
 */
export namespace Path {}
