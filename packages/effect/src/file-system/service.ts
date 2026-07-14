import * as Effect from 'effect/Effect'
import { makeExists, type Exists } from './operations/exists.js'
import { FileSystem } from './service-tag.js'

/** The typed FileSystem facade: Path-typed operations bound to one provided backend. */
export interface Api {
  readonly exists: Exists
}

/**
 * Yield the typed, bound FileSystem facade.
 *
 * `yield* FileSystem.service` mirrors native `yield* FileSystem.FileSystem`, but
 * its methods take Path values and checked literals instead of raw strings. This
 * maps Effect's service value to Kitz's typed method surface; it does not
 * introduce another service tag.
 */
export const service: Effect.Effect<Api, never, FileSystem> = Effect.map(
  FileSystem,
  (fileSystem) => ({
    exists: makeExists(fileSystem),
  }),
)
