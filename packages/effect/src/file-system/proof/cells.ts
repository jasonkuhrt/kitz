/**
 * INTERFACE PROOF — law cells for `./interface.ts`.
 *
 * Accepting cells pin exact inferred types with `Types.Equals`; rejecting cells
 * carry `@ts-expect-error`, so an unintended acceptance fails the typecheck
 * (TS2578). Cells live inside never-called functions: this file is checked,
 * never executed.
 */
import type * as Effect from 'effect/Effect'
import type { PlatformError } from 'effect/PlatformError'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import type * as Stream from 'effect/Stream'
import * as Path from '../../path/__.js'
import type { Types } from '../../types/_.js'
import * as FileSystem from './interface.js'

type Assert<$T extends true> = $T
type SuccessOf<$E> = $E extends Effect.Effect<infer $A, infer _E, infer _R> ? $A : never
type ErrorOf<$E> = $E extends Effect.Effect<infer _A, infer $E, infer _R> ? $E : never
type RequirementsOf<$E> = $E extends Effect.Effect<infer _A, infer _E, infer $R> ? $R : never

declare const dynamic: string
declare const anyPath: Path.Any
declare const absFile: Path.AbsFile
declare const relDir: Path.RelDir

// ─── Law 3: literal duality — a literal is the same operation as its decoded value

export const literalDuality = () => {
  const literal = FileSystem.read('./config.json')
  const value = FileSystem.read(Path.RelFile.make('./config.json'))
  type _same = Assert<Types.Equals<typeof literal, typeof value>>
  type _shape = Assert<
    Types.Equals<typeof literal, Effect.Effect<Uint8Array, PlatformError, FileSystem.Service>>
  >

  // @ts-expect-error — a directory literal in a file position
  void FileSystem.read('./config/')
  // @ts-expect-error — a widened string: decode it through a Path schema first
  void FileSystem.read(dynamic)
  // @ts-expect-error — a decoded directory value in a file position
  void FileSystem.read(relDir)
  // @ts-expect-error — malformed literal
  void FileSystem.read('')

  // A file-shaped literal in a directory position reads as that directory, as in `Path.join`.
  void FileSystem.makeDirectory('./cache', { recursive: true })
  void FileSystem.makeDirectory('./cache/', { recursive: true })
}

// ─── Law 5: stat re-classifies by evidence and keeps the input's anchoring

export const statWorlds = () => {
  const abs = FileSystem.stat('/etc/hosts')
  const rel = FileSystem.stat('./src/')
  const unknown = FileSystem.stat(anyPath)
  type _abs = Assert<Types.Equals<SuccessOf<typeof abs>, FileSystem.Info<Path.Abs>>>
  type _rel = Assert<Types.Equals<SuccessOf<typeof rel>, FileSystem.Info<Path.Rel>>>
  type _any = Assert<Types.Equals<SuccessOf<typeof unknown>, FileSystem.Info<FileSystem.World>>>

  const narrow = (info: FileSystem.Info<Path.Abs>) => {
    if (info._tag === 'Directory') {
      type _dir = Assert<Types.Equals<typeof info.path, Path.AbsDir>>
    } else {
      type _file = Assert<Types.Equals<typeof info.path, Path.AbsFile>>
    }
  }
  return narrow
}

// ─── Movement correlates kinds: file-to-file or directory-to-directory

export const movementKinds = () => {
  void FileSystem.copy('./a.txt', './b.txt', { existing: 'replace' })
  void FileSystem.copy('./a/', './b/', { existing: 'skip', preserveTimestamps: true })
  void FileSystem.rename(absFile, './renamed.txt')
  // A file-shaped literal in a directory destination reads as that directory.
  void FileSystem.copy('./a/', './b', { existing: 'replace' })

  // Curried: configuration first, reusable over data.
  const mirror = FileSystem.copyWith({ existing: 'replace' })
  void mirror('./src/', './backup/src/')
  void mirror('./a.txt', './b.txt')

  // @ts-expect-error — the existing-destination policy is required
  void FileSystem.copy('./a.txt', './b.txt')
  // @ts-expect-error — file source, directory destination
  void FileSystem.copy('./a.txt', './b/', { existing: 'replace' })
  // @ts-expect-error — the curried form keeps kind correlation
  void mirror('./a.txt', './b/')
  // @ts-expect-error — directory source, decoded file destination
  void FileSystem.rename('./a/', absFile)
}

// ─── Removal: only directories may request recursion

export const removal = () => {
  void FileSystem.remove('./build/', { recursive: true, force: true })
  void FileSystem.remove('./build.log', { force: true })
  void FileSystem.remove(anyPath, { recursive: true })

  // @ts-expect-error — recursion is not an option for a file
  void FileSystem.remove('./build.log', { recursive: true })
}

// ─── Handles expose exactly their capabilities

export const handles = () => {
  const readOnly = FileSystem.openRead('./data.bin')
  const writeOnly = FileSystem.openWrite('./data.bin')
  const readAppend = FileSystem.open('./data.bin', 'a+')
  const exclusive = FileSystem.openWith('wx')('./fresh.bin')
  type _scoped = Assert<
    Types.Equals<RequirementsOf<typeof readOnly>, FileSystem.Service | Scope.Scope>
  >
  // A named intent is exactly its `openWith` pre-application.
  const viaWith = FileSystem.openWith('r')('./data.bin')
  type _named = Assert<Types.Equals<typeof readOnly, typeof viaWith>>
  type _exclusive = Assert<
    Types.Equals<SuccessOf<typeof exclusive>, FileSystem.Handle<'write', Path.RelFile>>
  >

  const use = (
    r: SuccessOf<typeof readOnly>,
    w: SuccessOf<typeof writeOnly>,
    ra: SuccessOf<typeof readAppend>,
  ) => {
    void r.read(new Uint8Array(8))
    void w.writeAll(new Uint8Array(8))
    void ra.read(new Uint8Array(8))
    void ra.writeAll(new Uint8Array(8))
    type _path = Assert<Types.Equals<typeof r.path, Path.RelFile>>

    // @ts-expect-error — a read-only handle cannot write
    void r.writeAll(new Uint8Array(8))
    // @ts-expect-error — a write-only handle cannot read
    void w.read(new Uint8Array(8))
  }

  // @ts-expect-error — no implicit open mode: pass a flag or use a named intent
  void FileSystem.open('./data.bin')
  // @ts-expect-error — not an open flag
  void FileSystem.openWith('rw')
  return use
}

// ─── Temporary entries anchor like their directory (absolute when omitted)

export const temporary = () => {
  const system = FileSystem.makeTempDirectory()
  const absolute = FileSystem.makeTempDirectory({ directory: '/tmp/' })
  const relative = FileSystem.makeTempDirectory({ directory: './fixtures/' })
  const relativeFile = FileSystem.makeTempFile({ directory: './fixtures/' })
  const scoped = FileSystem.makeTempDirectoryScoped({ prefix: 'run-' })
  void FileSystem.makeTempDirectory({ prefix: Path.Segment.make('run-') })
  void FileSystem.makeTempFile({ directory: './fixtures/', suffix: '.json' })
  // @ts-expect-error — a prefix is a single segment
  void FileSystem.makeTempDirectory({ prefix: 'nested/run-' })
  type _system = Assert<Types.Equals<SuccessOf<typeof system>, Path.AbsDir>>
  type _absolute = Assert<Types.Equals<SuccessOf<typeof absolute>, Path.AbsDir>>
  type _relative = Assert<Types.Equals<SuccessOf<typeof relative>, Path.RelDir>>
  type _relativeFile = Assert<Types.Equals<SuccessOf<typeof relativeFile>, Path.RelFile>>
  type _scoped = Assert<
    Types.Equals<RequirementsOf<typeof scoped>, FileSystem.Service | Scope.Scope>
  >
}

// ─── Discovery and listing anchor to their root

export const discovery = () => {
  const underAbs = FileSystem.glob('**/*.ts', { root: '/workspace/' })
  const underCwd = FileSystem.glob('src/**')
  const listing = FileSystem.readDirectory('./src/')
  const names = FileSystem.readDirectoryNames('./src/')
  type _abs = Assert<
    Types.Equals<SuccessOf<typeof underAbs>, ReadonlyArray<FileSystem.Entry<Path.Abs>>>
  >
  type _cwd = Assert<
    Types.Equals<SuccessOf<typeof underCwd>, ReadonlyArray<FileSystem.Entry<Path.Rel>>>
  >
  type _listing = Assert<
    Types.Equals<SuccessOf<typeof listing>, ReadonlyArray<FileSystem.Entry<Path.Rel>>>
  >
  type _names = Assert<Types.Equals<SuccessOf<typeof names>, ReadonlyArray<Path.Segment>>>
  type _pathError = Assert<
    Types.Equals<ErrorOf<typeof listing>, PlatformError | FileSystem.PathError>
  >

  void FileSystem.glob('**/*.ts', {
    root: './',
    exclude: ['**/node_modules/**', FileSystem.Glob.make('**/build/**')],
  })

  // @ts-expect-error — patterns are root-relative; pass the anchor as `root`
  void FileSystem.glob('/workspace/**')
  // @ts-expect-error — exclusions are patterns too, validated element by element
  void FileSystem.glob('**/*.ts', { exclude: ['**/node_modules/**', '/abs/**'] })
  // @ts-expect-error — a widened pattern string
  void FileSystem.glob(dynamic)
}

// ─── Watch events carry kind-erased addresses in the watched root's world

export const watching = () => {
  const events = FileSystem.watch('/var/log/', { recursive: true })
  type _events = Assert<
    Types.Equals<
      typeof events,
      Stream.Stream<
        FileSystem.WatchEvent<Path.AbsDir>,
        PlatformError | FileSystem.PathError,
        FileSystem.Service
      >
    >
  >
}

// ─── Law 7: content types come from an explicit codec

export const codecs = () => {
  const Config = Schema.fromJsonString(Schema.Struct({ ready: Schema.Boolean }))
  const config = FileSystem.decode('./state.json', Config)
  type _config = Assert<Types.Equals<SuccessOf<typeof config>, { readonly ready: boolean }>>
  type _errors = Assert<Types.Equals<ErrorOf<typeof config>, PlatformError | Schema.SchemaError>>
  void FileSystem.encode('./state.json', Config, { ready: true })

  // Curried: bind the codec once, reuse it over files.
  const readConfig = FileSystem.decodeWith(Config)
  const writeConfig = FileSystem.encodeWith(Config)
  type _curried = Assert<Types.Equals<typeof config, ReturnType<typeof readConfig<'./state.json'>>>>
  void writeConfig('./state.json', { ready: false })

  // @ts-expect-error — the value must match the codec's decoded type
  void FileSystem.encode('./state.json', Config, { ready: 'yes' })
  // @ts-expect-error — the curried form keeps the codec's type
  void writeConfig('./state.json', { ready: 'yes' })
  // @ts-expect-error — the curried form keeps literal duality
  void readConfig('./config/')
}

// ─── Links keep their own grammar

export const links = () => {
  void FileSystem.symbolicLink('../shared/config.json', './config.json')
  void FileSystem.symbolicLink(FileSystem.LinkTarget.make('./src/'), './current')
  void FileSystem.hardLink('./a.txt', './b.txt')
  const target = FileSystem.readLink('./current')
  type _target = Assert<Types.Equals<SuccessOf<typeof target>, FileSystem.LinkTarget>>

  // @ts-expect-error — an empty link target
  void FileSystem.symbolicLink('', './current')
  // @ts-expect-error — hard links join files, never directories
  void FileSystem.hardLink('./a/', './b.txt')
}

// ─── Permissions curry their configuration

export const permissions = () => {
  const privateMode = FileSystem.chmodWith(FileSystem.Mode.make(0o600))
  void privateMode('./secret.key')
  void FileSystem.chmod('./secret.key', FileSystem.Mode.make(0o600))

  // @ts-expect-error — modes are branded: decode or construct them, never a bare number
  void FileSystem.chmod('./secret.key', 0o600)
}

// ─── Law 1: the bound façade is the same surface with requirements discharged

export const facade = () => {
  const use = (fs: FileSystem.Api) => {
    const bytes = fs.read('/workspace/input.bin')
    type _discharged = Assert<Types.Equals<RequirementsOf<typeof bytes>, never>>
    // @ts-expect-error — the bound façade keeps literal duality
    void fs.read('/workspace/')
  }
  type _service = Assert<
    Types.Equals<
      typeof FileSystem.service,
      Effect.Effect<FileSystem.Api, never, FileSystem.Service>
    >
  >
  return use
}
