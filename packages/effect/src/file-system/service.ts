import * as Context from 'effect/Context'
import type { Exists } from './operations/exists.js'

/**
 * The typed FileSystem surface: Path-native operations. This is the shape of
 * Kitz's own {@link FileSystem} service — the thing you get from
 * `yield* FileSystem.FileSystem`.
 */
export interface Api {
  readonly exists: Exists
}

/**
 * Kitz's own FileSystem service — a typed, Path-native capability with **no**
 * relationship to Effect's `FileSystem`: it is not a re-export, alias, or view
 * of that tag, and this module imports nothing from `effect/FileSystem`.
 *
 * Layers provide this tag directly (`FileSystem.layerMemory`), and
 * `yield* FileSystem.FileSystem` yields the typed {@link Api} — one yield
 * point, method-only, mirroring native `yield* FileSystem.FileSystem` but with
 * Path-typed operations.
 */
export class FileSystem extends Context.Service<FileSystem, Api>()('@kitz/effect/FileSystem') {}
