import * as Effect from 'effect/Effect'
import * as FileSystemEffect from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import type * as PlatformError from 'effect/PlatformError'
import * as Result from 'effect/Result'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import { emptyState, type State, walk } from './internal/memory-graph.js'
import { unsupportedPrimitives } from './internal/unsupported.js'

/**
 * The `access` primitive over the inode graph. It takes an arbitrary upstream
 * POSIX string — not a decoded Kitz Path — because it implements Effect's raw
 * string service contract.
 *
 * This is the only existence-related code the backend owns: `FileSystem.make`
 * derives `exists` from it (accessible → true, `NotFound` → false, anything else
 * propagates), so those semantics are never restated here.
 */
const access =
  (state: SynchronizedRef.SynchronizedRef<State>) =>
  (path: string): Effect.Effect<void, PlatformError.PlatformError> =>
    Effect.flatMap(SynchronizedRef.get(state), (snapshot) => {
      const resolved = walk(snapshot, path)
      return Result.isFailure(resolved) ? Effect.fail(resolved.failure) : Effect.void
    })

/**
 * In-memory `FileSystem` layer — a fresh, empty inode graph providing Effect's
 * own `FileSystem` tag. A real implementation of that service, not a mock and
 * not `layerNoop`: every operation the graph does not implement yet fails
 * loudly as unsupported (see `internal/unsupported.ts`) rather than returning a
 * plausible wrong answer.
 *
 * Because it provides the upstream tag, it is a drop-in for
 * `NodeFileSystem.layer` — any Effect code in the program, not just Kitz's
 * typed operations, observes this filesystem.
 *
 * Standard empty-start layer with no construction DSL: populate it by running
 * the filesystem's own write operations once they land.
 */
export const layerMemory = (): Layer.Layer<FileSystemEffect.FileSystem> =>
  Layer.effect(FileSystemEffect.FileSystem)(
    Effect.map(SynchronizedRef.make(emptyState()), (state) =>
      FileSystemEffect.make({ ...unsupportedPrimitives, access: access(state) }),
    ),
  )
