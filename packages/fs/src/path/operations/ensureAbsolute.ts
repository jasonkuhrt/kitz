import { Fn } from '@kitz/core'
import { Schema as S } from 'effect'
import type { $Abs } from '../$Abs/_.js'
import { $Abs as Abs } from '../$Abs/_.js'
import type { $Rel } from '../$Rel/_.js'
import type { Path } from '../_.js'
import type { AbsDir } from '../AbsDir/_.js'
import { join } from './join.js'
import type { toAbs } from './toAbs.js'

/**
 * Type-level ensureAbsolute operation.
 * Maps path types to their absolute counterparts:
 * - AbsDir → AbsDir (unchanged)
 * - AbsFile → AbsFile (unchanged)
 * - RelDir → AbsDir
 * - RelFile → AbsFile
 */
export type ensureAbsolute<$P extends Path> = $P extends $Abs ? $P : $P extends $Rel ? toAbs<$P> : never

/**
 * Ensure a location is absolute, converting relative locations to absolute.
 *
 * This is a pure function that requires an explicit base directory.
 * Use curried variant {@link ensureAbsoluteWith} to pre-apply the base.
 *
 * @param path - The path to ensure is absolute
 * @param base - The base directory to resolve relative paths against
 * @returns An absolute path
 *
 * @example
 * ```ts
 * const relPath = Path.RelFile.make({
 *   segments: ['foo'],
 *   fileName: { stem: 'bar', extension: '.ts' }
 * })
 * const cwd = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const absPath = ensureAbsolute(relPath, cwd) // AbsFile /home/user/foo/bar.ts
 * ```
 */
export const ensureAbsolute = <
  L extends Path,
  B extends AbsDir,
>(
  path: L,
  base: B,
): ensureAbsolute<L> => {
  // If already absolute, return as-is
  if (S.is(Abs.Schema)(path)) {
    return path as any
  }

  // Convert relative to absolute using join
  return join(base, path as any) as any
}

/**
 * Curried variant of {@link ensureAbsolute}.
 * Pre-apply the path, then apply the base directory.
 */
export const ensureAbsoluteOn: <L extends Path>(path: L) => <B extends AbsDir>(base: B) => ensureAbsolute<L> = Fn
  .curry(ensureAbsolute) as any

/**
 * Curried variant of {@link ensureAbsolute}.
 * Pre-apply the base directory, then apply to paths.
 *
 * @example
 * ```ts
 * const cwd = yield* Env.cwd
 * const toAbs = ensureAbsoluteWith(cwd)
 * const abs1 = toAbs(relPath1)
 * const abs2 = toAbs(relPath2)
 * ```
 */
export const ensureAbsoluteWith: <B extends AbsDir>(base: B) => <L extends Path>(path: L) => ensureAbsolute<L> = Fn
  .flipCurried(ensureAbsoluteOn) as any

/**
 * Type-level ensureOptionalAbsolute operation.
 */
export type ensureOptionalAbsolute<L extends Path | undefined> = L extends undefined ? undefined
  : L extends Path ? ensureAbsolute<L>
  : never

/**
 * Ensure an optional location is absolute.
 *
 * This is a pure function that requires an explicit base directory.
 * Use curried variant {@link ensureOptionalAbsoluteWith} to pre-apply the base.
 *
 * @param path - The optional path to ensure is absolute
 * @param base - Base directory to resolve against
 * @returns An absolute path or undefined if path is undefined
 *
 * @example
 * ```ts
 * const base = Path.AbsDir.make({ segments: ['home', 'user'] })
 * const path: Path.RelFile | undefined = undefined
 * const result = ensureOptionalAbsolute(path, base) // undefined
 * ```
 */
export const ensureOptionalAbsolute = <
  L extends Path | undefined,
  B extends AbsDir,
>(
  path: L,
  base: B,
): ensureOptionalAbsolute<L> => {
  if (path === undefined) {
    return undefined as any
  }

  return ensureAbsolute(path, base) as any
}

/**
 * Curried variant of {@link ensureOptionalAbsolute}.
 * Pre-apply the path, then apply the base directory.
 */
export const ensureOptionalAbsoluteOn: <L extends Path | undefined>(
  path: L,
) => <B extends AbsDir>(base: B) => ensureOptionalAbsolute<L> = Fn.curry(ensureOptionalAbsolute) as any

/**
 * Curried variant of {@link ensureOptionalAbsolute}.
 * Pre-apply the base directory, then apply to paths.
 *
 * @example
 * ```ts
 * const cwd = yield* Env.cwd
 * const toAbs = ensureOptionalAbsoluteWith(cwd)
 * const abs1 = toAbs(relPath1)           // absolute path
 * const abs2 = toAbs(undefined)          // undefined
 * ```
 */
export const ensureOptionalAbsoluteWith: <B extends AbsDir>(
  base: B,
) => <L extends Path | undefined>(path: L) => ensureOptionalAbsolute<L> = Fn.flipCurried(
  ensureOptionalAbsoluteOn,
) as any
