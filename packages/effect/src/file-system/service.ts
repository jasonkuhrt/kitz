import * as Effect from 'effect/Effect'
import * as FileSystemEffect from 'effect/FileSystem'
import { bindExists, type ExistsBound } from './operations/exists.js'

/**
 * Effect's exact `FileSystem` tag and interface — re-exported, not wrapped.
 *
 * Kitz introduces no second `Context` identity: there is one filesystem
 * capability in the environment, so `NodeFileSystem.layer` (from
 * `@effect/platform-node`) and {@link layerMemory} both provide *this* tag, and
 * any other Effect code in the program observes the same filesystem.
 */
export const Service = FileSystemEffect.FileSystem
export type Service = FileSystemEffect.FileSystem

/**
 * The typed FileSystem surface: Path-native operations with the service already
 * bound, so their requirements are discharged.
 */
export interface Api {
  readonly exists: ExistsBound
}

/**
 * The typed façade over the upstream service — a **view, not a tag**. It is an
 * `Effect`, not a `Context` identity: nothing provides it, and providing a
 * filesystem layer is all a program ever needs.
 *
 * ```ts
 * const fs = yield* FileSystem.service
 * yield* fs.exists('./config.json')
 * ```
 *
 * The top-level operations (`FileSystem.exists`, …) are canonical for
 * composition; this accessor only offers method-style use of the same ones.
 */
export const service: Effect.Effect<Api, never, Service> = Effect.map(
  Service,
  (fileSystem): Api => ({
    exists: bindExists(fileSystem),
  }),
)
