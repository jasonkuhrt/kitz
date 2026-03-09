import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Effect, Scope } from 'effect'
import { makeTempDirectory, makeTempDirectoryScoped } from '../filesystem.js'
import { Path } from '../path/_.js'

/**
 * Represents a directory with an absolute base path.
 * This is the core data type that operations work with.
 */
export interface Builder {
  readonly base: Path.AbsDir
}

/**
 * Create a Builder instance with the specified base path.
 *
 * @param base - The absolute directory path to use as the base
 * @returns A new Builder instance
 *
 * @example
 * ```ts
 * const builder = Fs.Builder.create('/project')
 * ```
 */
export const create = (base: Path.Input.AbsDir): Builder => ({
  base: Path.normalizeDynamicInput(Path.AbsDir.Schema)(base),
})

/**
 * Create a temporary directory that will be automatically cleaned up
 * when the Effect scope ends.
 *
 * @returns An Effect that yields a Builder instance pointing to a temp directory
 *
 * @example
 * ```ts
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const temp = yield* Fs.Builder.createTemp()
 *     // Use temp directory...
 *   }) // Automatically cleaned up when scope ends
 * )
 * ```
 */
export const createTemp = (): Effect.Effect<
  Builder,
  PlatformError,
  Scope.Scope | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const absDir = yield* makeTempDirectoryScoped({ prefix: 'kit-builder-' })
    return create(absDir)
  })

/**
 * Create a temporary directory without automatic cleanup.
 * The caller is responsible for removing the directory when done.
 *
 * @returns An Effect that yields a Builder instance pointing to a new temp directory
 *
 * @example
 * ```ts
 * const temp = yield* Fs.Builder.createTempUnsafe()
 * // Use temp directory...
 * // Must manually clean up when done
 * yield* Fs.remove(temp.base, { recursive: true })
 * ```
 */
export const createTempUnsafe = (): Effect.Effect<Builder, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const absDir = yield* makeTempDirectory({ prefix: 'kit-builder-' })
    return create(absDir)
  })
