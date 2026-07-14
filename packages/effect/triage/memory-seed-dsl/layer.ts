import * as Effect from 'effect/Effect'
import * as PlatformFileSystem from 'effect/FileSystem'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import { Service } from '../file-system/service-tag.js'
import type { LiteralGuard } from '../path/core/literal.js'
import * as Path from '../path/__.js'
import type { Entry } from './entry.js'
import { InitializationError } from './InitializationError.js'
import { emptyState, initialize, type State, walk } from './internal/state.js'

type CwdLiteralGuard<$Cwd extends string> = LiteralGuard<
  $Cwd,
  Path.AbsDir,
  'MemoryFileSystem.layer'
>

/** Options for a fresh, isolated in-memory filesystem. */
export interface LayerOptions<$Cwd extends Path.AbsDir | string = Path.AbsDir> {
  readonly cwd?: $Cwd extends string ? CwdLiteralGuard<$Cwd> : $Cwd
  readonly entries?: Iterable<Entry>
}

interface RuntimeOptions {
  readonly cwd?: Path.AbsDir | string
  readonly entries?: Iterable<Entry>
}

const unsupported = (method: string): Effect.Effect<never> =>
  Effect.die(`MemoryFileSystem.${method} is not implemented in the exists vertical slice`)

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
  watch: () =>
    Stream.die('MemoryFileSystem.watch is not implemented in the exists vertical slice'),
  writeFile: () => unsupported('writeFile'),
})

const decodeCwd = (
  input: Path.AbsDir | string | undefined,
): Effect.Effect<Path.AbsDir, InitializationError> => {
  if (input === undefined) return Effect.succeed(Path.AbsDir.anchor)
  if (typeof input !== 'string') return Effect.succeed(input)

  return Schema.decodeEffect(Path.AbsDir)(input).pipe(
    Effect.mapError(() => new InitializationError({ reason: 'InvalidCwd', path: input })),
  )
}

const access = (
  state: SynchronizedRef.SynchronizedRef<State>,
): PlatformFileSystem.FileSystem['access'] =>
  (path) =>
    SynchronizedRef.get(state).pipe(
      Effect.flatMap((snapshot) => Effect.fromResult(walk(snapshot, path))),
      Effect.asVoid,
    )

const make = (initial: State): Effect.Effect<Service> =>
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

const makeConfigured = (options: RuntimeOptions): Effect.Effect<Service, InitializationError> =>
  Effect.gen(function* () {
    const cwd = yield* decodeCwd(options.cwd)
    const initial = yield* Effect.fromResult(initialize(cwd, options.entries ?? []))
    return yield* make(initial)
  })

/**
 * Provide Effect's exact filesystem service from a fresh in-memory inode graph.
 * Each layer construction is isolated; no process or host filesystem global is
 * consulted.
 */
export function layer(): Layer.Layer<Service>
export function layer<const $Cwd extends Path.AbsDir | string = Path.AbsDir>(
  options: LayerOptions<$Cwd>,
): Layer.Layer<Service, InitializationError>
export function layer(
  options?: RuntimeOptions,
): Layer.Layer<Service, InitializationError> {
  return options === undefined
    ? Layer.effect(Service)(make(emptyState()))
    : Layer.effect(Service)(makeConfigured(options))
}
