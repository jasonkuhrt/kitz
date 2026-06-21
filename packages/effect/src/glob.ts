import { Effect, FileSystem, type PlatformError } from 'effect'
import picomatch from 'picomatch'
import { Path } from './path/_.js'

/**
 * Options for globbing file patterns.
 *
 * Globbing walks the injected {@link FileSystem.FileSystem} service, so it honors
 * whatever platform layer is provided (Node, Bun, or the in-memory layer) — it is
 * not tied to the real filesystem.
 */
export interface GlobOptions {
  /**
   * Directory to search from. Results are returned relative to it (or absolute when
   * `absolute` is set and an {@link Path.AbsDir} is given).
   *
   * Defaults to `'.'` (the platform layer's current directory). Pass a
   * {@link Path.AbsDir} to produce absolute results.
   */
  cwd?: Path.AbsDir | URL
  /** Match files only. @default true (unless `onlyDirectories` is set) */
  onlyFiles?: boolean
  /** Match directories only. @default false */
  onlyDirectories?: boolean
  /** Return absolute paths. Requires an {@link Path.AbsDir} `cwd`. @default false */
  absolute?: boolean
  /** Include entries that start with a dot. @default false */
  dot?: boolean
  /** Glob pattern(s) to exclude from results. */
  ignore?: string | string[]
}

/**
 * Type helper to infer the Path return type based on glob options.
 * - `onlyDirectories: true` -> Dir types; otherwise File types (onlyFiles defaults true)
 * - `onlyFiles: false` -> both File and Dir
 * - `absolute: true` -> absolute locations; otherwise relative
 */
type InferGlobReturn<O extends GlobOptions | undefined> = O extends undefined
  ? Path.RelFile
  : O extends { onlyDirectories: true; absolute: true }
    ? Path.AbsDir
    : O extends { onlyDirectories: true }
      ? Path.RelDir
      : O extends { onlyFiles: false; absolute: true }
        ? Path.$Abs
        : O extends { onlyFiles: false }
          ? Path.$Rel
          : O extends { absolute: true }
            ? Path.AbsFile
            : O extends GlobOptions
              ? Path.RelFile
              : never

/** Join two POSIX path fragments, collapsing the separator. */
const joinPosix = (base: string, name: string): string =>
  base === '' || base === '.' ? name : `${base.replace(/\/+$/, '')}/${name}`

const cwdToString = (cwd: Path.AbsDir | URL | undefined): string => {
  if (cwd === undefined) return '.'
  if (cwd instanceof URL) return cwd.pathname
  return Path.toString(cwd)
}

/**
 * Recursively collect every entry under `root`, walking one directory level at a
 * time through the FileSystem service. Returns root-relative paths tagged with
 * whether each is a directory.
 */
const walk = (
  root: string,
  dir: string,
): Effect.Effect<
  ReadonlyArray<{ readonly rel: string; readonly isDirectory: boolean }>,
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const absDir = joinPosix(root, dir)
    const names = yield* fs.readDirectory(absDir === '' ? '.' : absDir)
    const out: Array<{ rel: string; isDirectory: boolean }> = []
    for (const name of names) {
      const rel = joinPosix(dir, name)
      const info = yield* fs.stat(joinPosix(root, rel))
      const isDirectory = info.type === 'Directory'
      out.push({ rel, isDirectory })
      if (isDirectory) {
        out.push(...(yield* walk(root, rel)))
      }
    }
    return out
  })

/**
 * Glob for paths matching `pattern`, returning typed {@link Path} values.
 *
 * Walks the injected {@link FileSystem.FileSystem} service (so it works against any
 * platform layer, including the in-memory one) and matches with
 * [picomatch](https://github.com/micromatch/picomatch). The return type is refined
 * by the options (files vs directories, relative vs absolute).
 *
 * @param pattern - The glob pattern(s) to match (matched against cwd-relative paths)
 * @param options - {@link GlobOptions}
 * @returns Effect of matched {@link Path} values; requires a `FileSystem` layer
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { NodeContext } from '@effect/platform-node'
 * import { FileSystem, Path } from '@kitz/effect'
 *
 * const program = Effect.gen(function* () {
 *   const relFiles = yield* FileSystem.glob('src/**' + '/*.ts')
 *   const dirs = yield* FileSystem.glob('src/**', { onlyDirectories: true })
 *   const srcDir = Path.AbsDir.fromString('/project/')
 *   const absFiles = yield* FileSystem.glob('**' + '/*.ts', { cwd: srcDir, absolute: true })
 * })
 *
 * program.pipe(Effect.provide(NodeContext.layer), Effect.runPromise)
 * ```
 */
export const glob = <O extends GlobOptions | undefined = undefined>(
  pattern: string | string[],
  options?: O,
): Effect.Effect<InferGlobReturn<O>[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const root = cwdToString(options?.cwd)
    const matchOptions = { dot: options?.dot ?? false }
    const isMatch = picomatch(pattern, matchOptions)
    const isIgnored = options?.ignore
      ? picomatch(options.ignore, { dot: true })
      : (_: string) => false

    const onlyDirectories = options?.onlyDirectories === true
    const onlyFiles = !onlyDirectories && (options?.onlyFiles ?? true)
    const absolute = options?.absolute === true

    const entries = yield* walk(root, '')

    const results: InferGlobReturn<O>[] = []
    for (const { rel, isDirectory } of entries) {
      if (onlyFiles && isDirectory) continue
      if (onlyDirectories && !isDirectory) continue
      if (!isMatch(rel) || isIgnored(rel)) continue

      const withSlash = isDirectory ? `${rel}/` : rel
      const pathString = absolute
        ? `${root.replace(/\/+$/, '')}/${withSlash}`
        : withSlash.startsWith('./') || withSlash.startsWith('../')
          ? withSlash
          : `./${withSlash}`

      results.push(Path.fromString(pathString) as InferGlobReturn<O>)
    }

    return results
  })
