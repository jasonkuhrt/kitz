import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as PlatformError from 'effect/PlatformError'
import * as Result from 'effect/Result'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import { makeExists } from './operations/exists.js'
import { emptyState, type State, walk } from './internal/memory-graph.js'
import { FileSystem } from './service.js'

// The existence semantics Effect's own Node layer derives from `access`, here
// implemented directly over the inode graph: accessible → true, NotFound →
// false, any other resolution failure (e.g. a non-directory in the path) →
// propagate.
const existsCheck =
  (state: SynchronizedRef.SynchronizedRef<State>) =>
  (path: string): Effect.Effect<boolean, PlatformError.PlatformError> =>
    SynchronizedRef.get(state).pipe(
      Effect.flatMap((snapshot) => {
        const result = walk(snapshot, path)
        if (Result.isFailure(result)) {
          return result.failure.reason._tag === 'NotFound'
            ? Effect.succeed(false)
            : Effect.fail(result.failure)
        }
        return Effect.succeed(true)
      }),
    )

/**
 * In-memory `FileSystem` layer — a fresh, empty inode graph providing Kitz's
 * own {@link FileSystem} service.
 *
 * Standard, empty-start layer (mirrors Effect's `layerMemory` convention) with
 * no construction DSL: populate it by running the filesystem's own write
 * operations. Every operation is implemented directly against the graph — this
 * module imports nothing from `effect/FileSystem`.
 */
export const layerMemory = (): Layer.Layer<FileSystem> =>
  Layer.effect(FileSystem)(
    Effect.map(SynchronizedRef.make(emptyState()), (state) => ({
      exists: makeExists(existsCheck(state)),
    })),
  )
