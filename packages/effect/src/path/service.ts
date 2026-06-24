import { Context, Layer } from 'effect'
import type { Path as AnyPath } from './_.js'
import type { AbsDir } from './models/AbsDir.js'
import { ensureAbsolute } from './operations/ensureAbsolute.js'

/**
 * Shape of the {@link Path} service.
 */
export interface PathShape {
  /** Base directory that relative paths resolve against. */
  readonly cwd: AbsDir
  /**
   * Resolve a path to absolute. Absolute paths pass through unchanged; relative
   * paths resolve against {@link cwd}.
   */
  resolve<L extends AnyPath>(path: L): ensureAbsolute<L>
}

/**
 * `Path` service — carries a working directory so relative paths can be resolved
 * without threading a base directory through every call. Mirrors effect's
 * `Path.Path` (and supersedes it for `@kitz/effect` consumers).
 *
 * Pure path algebra (`Path.join`, `Path.up`, …) needs no service; this service
 * exists only for the one contextual concern — the working directory.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { Path } from '@kitz/effect'
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return path.resolve(Path.RelFile.fromString('./src/index.ts'))
 * }).pipe(Effect.provide(Path.Path.layer(Path.AbsDir.fromString('/home/user/'))))
 * ```
 */
export class Path extends Context.Service<Path, PathShape>()('@kitz/effect/Path') {
  /** Provide the service with an explicit working directory. */
  static layer = (cwd: AbsDir): Layer.Layer<Path> =>
    Layer.succeed(Path)({
      cwd,
      resolve: <L extends AnyPath>(path: L): ensureAbsolute<L> => ensureAbsolute(path, cwd),
    })
}
