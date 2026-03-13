import { FileSystem } from 'effect'
import { Effect, Option } from 'effect'
import { Path } from './path/_.js'

/**
 * Type helper to infer return type based on input relative paths.
 * - If all paths are RelFile, returns AbsFile
 * - If all paths are RelDir, returns AbsDir
 * - If mixed, returns union of AbsFile | AbsDir
 */
type InferReturnType<T extends Path.$Rel> = T extends Path.RelFile
  ? Path.AbsFile
  : T extends Path.RelDir
    ? Path.AbsDir
    : Path.$Abs

/**
 * Find the first existing path under a directory.
 *
 * Takes an absolute directory and a list of relative paths,
 * and returns the first one that exists on the filesystem.
 *
 * @param dir - The absolute directory to search under
 * @param paths - Array of relative paths (files or directories) to check
 * @returns The first existing absolute path, or None if none exist
 *
 * @example
 * ```ts
 * import { Fs } from '@kitz/fs'
 * import { Fs } from '@kitz/fs'
 *
 * const dir = Path.AbsDir.decodeStringSync('/project/')
 * const paths = [
 *   Path.RelFile.decodeStringSync('./config.local.json'),
 *   Path.RelFile.decodeStringSync('./config.json')
 * ]
 *
 * const result = yield* Fs.findFirstUnderDir(dir)(paths)
 * // result: Option<AbsFile> since all inputs are RelFile
 * ```
 */
export const findFirstUnderDir =
  (dir: Path.AbsDir) =>
  <paths extends Path.$Rel>(
    paths: readonly paths[],
  ): Effect.Effect<Option.Option<InferReturnType<paths>>, Error, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      // Check each path for existence, maintaining the index relationship
      const checks = yield* Effect.all(
        paths.map((relativePath) => {
          // Join to get absolute path for checking
          const absolutePath = Path.join(dir, relativePath)
          const pathStr = absolutePath.toString()
          return fs.exists(pathStr).pipe(
            // Return the absolute path if it exists (this is what we want!)
            Effect.map((exists) => (exists ? absolutePath : undefined)),
            Effect.mapError(
              (error) => new Error(`Failed to check path existence: ${pathStr} - ${String(error)}`),
            ),
          )
        }),
      )

      // Find the first existing path and wrap in Option
      const firstExisting = checks.find((maybePath) => maybePath !== undefined)
      return firstExisting === undefined
        ? Option.none()
        : Option.some(firstExisting as InferReturnType<paths>)
    })
