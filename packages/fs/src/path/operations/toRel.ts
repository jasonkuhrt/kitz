import * as NodePath from 'path'
import type { $Abs } from '../$Abs/_.js'
import type { $Rel } from '../$Rel/_.js'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'
import { fromString } from './fromString.js'
import { toString } from './toString.js'

/**
 * Type-level toRel operation.
 * Maps absolute location types to their relative counterparts.
 */
export type toRel<A extends $Abs> = A extends AbsFile ? RelFile
  : A extends AbsDir ? RelDir
  : $Rel

/**
 * Convert an absolute location to a relative location.
 *
 * @param abs - The absolute location to convert
 * @param base - The base directory to make the path relative to
 * @returns A relative location
 *
 * @example
 * ```ts
 * const absFile = Path.AbsFile.make({
 *   segments: ['home', 'user', 'src'],
 *   fileName: { stem: 'index', extension: '.ts' }
 * })
 * const base = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const relFile = toRel(absFile, base) // ./src/index.ts
 * ```
 */
export const toRel = <
  $abs extends $Abs,
  $base extends AbsDir,
>(
  abs: $abs,
  base: $base,
): toRel<$abs> => {
  const absPath = toString(abs)
  const basePath = toString(base)

  // Calculate relative path using Node.js built-in
  const relativePath = NodePath.relative(basePath, absPath)

  // If empty, it means we're at the same location
  const finalPath = relativePath === '' ? '.' : relativePath
  return fromString(finalPath) as any
}
