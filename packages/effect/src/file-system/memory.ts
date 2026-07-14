import * as Effect from 'effect/Effect'
import * as PlatformFileSystem from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import { emptyState, type State, walk } from './internal/memory-graph.js'
import { FileSystem } from './service-tag.js'

const unsupported = (method: string): Effect.Effect<never> =>
  Effect.die(`FileSystem.layerMemory: ${method} is not implemented yet`)

const scaffold: Parameters<typeof PlatformFileSystem.make>[0] = PlatformFileSystem.makeNoop({
  chmod: () => unsupported('chmod'),
  chown: () => unsupported('chown'),
  copy: () => unsupported('copy'),
  copyFile: () => unsupported('copyFile'),
  glob: () => unsupported('glob'),
  link: () => unsupported('link'),
  makeDirectory: () => unsupported('makeDirectory'),
  makeTempDirectory: () => unsupported('makeTempDirectory'),
  makeTempDirectoryScoped: () => unsupported('makeTempDirectoryScoped'),
  makeTempFile: () => unsupported('makeTempFile'),
  makeTempFileScoped: () => unsupported('makeTempFileScoped'),
  open: () => unsupported('open'),
  readDirectory: () => unsupported('readDirectory'),
  readFile: () => unsupported('readFile'),
  readLink: () => unsupported('readLink'),
  realPath: () => unsupported('realPath'),
  remove: () => unsupported('remove'),
  rename: () => unsupported('rename'),
  stat: () => unsupported('stat'),
  symlink: () => unsupported('symlink'),
  truncate: () => unsupported('truncate'),
  utimes: () => unsupported('utimes'),
  watch: () => Stream.die('FileSystem.layerMemory: watch is not implemented yet'),
  writeFile: () => unsupported('writeFile'),
})

const access =
  (state: SynchronizedRef.SynchronizedRef<State>): PlatformFileSystem.FileSystem['access'] =>
  (path) =>
    SynchronizedRef.get(state).pipe(
      Effect.flatMap((snapshot) => Effect.fromResult(walk(snapshot, path))),
      Effect.asVoid,
    )

const make = (initial: State): Effect.Effect<FileSystem> =>
  Effect.gen(function* () {
    const state = yield* SynchronizedRef.make(initial)

    // Effect derives `exists` from this `access` primitive, exactly as its Node
    // implementation does. Every remaining primitive fails loudly until its
    // horizontal slice replaces the corresponding scaffold slot.
    return PlatformFileSystem.make({
      ...scaffold,
      access: access(state),
    })
  })

/**
 * In-memory `FileSystem` layer — a fresh, empty inode graph that provides
 * Effect's exact `FileSystem` service.
 *
 * This mirrors Effect's own `layerMemory` convention (`KeyValueStore.layerMemory`,
 * `Persistence.layerMemory`) and its `FileSystem.layerNoop`: a standard,
 * empty-start layer that lives as a member of the service module, with no
 * construction DSL. Populate it by running the filesystem's own write
 * operations, exactly as you would a real backend.
 */
export const layerMemory = (): Layer.Layer<FileSystem> =>
  Layer.effect(FileSystem)(make(emptyState()))
