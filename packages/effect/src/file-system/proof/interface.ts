/**
 * INTERFACE PROOF — the agreement artifact for `@kitz/effect/FileSystem` 0.1.0.
 *
 * Types only. Every operation is a `declare const` over its final public
 * signature, compiled against the real `effect` and Path sources, so the shape
 * is checked rather than described. `cells.ts` pins the literal and type laws
 * with accepting and `@ts-expect-error` cells. Nothing here ships: once the
 * shape is agreed, the implementation replaces these declarations.
 *
 * Scope (agreed): the typed layer over Effect's native `FileSystem` service,
 * proven against `NodeFileSystem.layer`. The in-memory backend is out of 0.1.0.
 *
 * Compiled against effect 4.0.0-beta.97 (current main). The rc line renames the
 * upstream size type to `ByteSize`; {@link ByteCount} aliases whichever the
 * installed Effect provides.
 */
import type * as Brand from 'effect/Brand'
import type * as Data from 'effect/Data'
import type * as DateTime from 'effect/DateTime'
import type * as Effect from 'effect/Effect'
import type * as EffectFileSystem from 'effect/FileSystem'
import type * as Option from 'effect/Option'
import type { PlatformError } from 'effect/PlatformError'
import type * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import type * as Sink from 'effect/Sink'
import type * as Stream from 'effect/Stream'
import type * as Path from '../../path/__.js'
import type { FromTargetLiteral, LiteralGuard } from '../../path/core/literal.js'
import type { SegmentLiteralGuard } from '../../path/models/segment.js'
import type { Types } from '../../types/_.js'

// ─── Service identity (law 1: one capability) ───────────────────────────────

/** Effect's exact `FileSystem` tag. Kitz adds no second `Context` identity. */
export declare const Service: typeof EffectFileSystem.FileSystem
export type Service = EffectFileSystem.FileSystem

// ─── Path positions (law 3: literal duality everywhere) ─────────────────────

/** A path position: a decoded `$Target` value, or a literal that statically decodes into `$Target`. */
type PathArg<$Arg, $Target, $Op extends string> = $Arg extends string
  ? LiteralGuard<$Arg, $Target, `FileSystem.${$Op}`>
  : $Arg

/** The decoded path value a path position denotes. */
type PathOf<$Arg, $Target> = $Arg extends string ? FromTargetLiteral<$Arg, $Target> : $Arg

/** A path's anchoring group. Results inherit it from the input that determined them. */
export type World = Path.Abs | Path.Rel

type WorldOf<$Path> = $Path extends Path.Abs ? Path.Abs : $Path extends Path.Rel ? Path.Rel : never

type FileOf<$World> = Extract<$World, Path.File>

type DirOf<$World> = Extract<$World, Path.Dir>

/** The destination kind a binary operation requires, given its source. */
type SameKind<$Path> = $Path extends Path.File
  ? Path.File
  : $Path extends Path.Dir
    ? Path.Dir
    : never

type ErrorKindMismatch =
  Types.StaticError<'FileSystem: source and destination must both be files or both be directories'>

/** A destination position whose file/directory kind must match the source's. */
type KindArg<$To, $From, $Op extends string> = $To extends string
  ? LiteralGuard<$To, SameKind<$From>, `FileSystem.${$Op}`>
  : $To extends SameKind<$From>
    ? $To
    : ErrorKindMismatch

// ─── Metadata domain types ──────────────────────────────────────────────────

/** POSIX permission bits (`0o000`–`0o7777`). Schema-backed: `Mode.make(0o644)`. */
export type Mode = number & Brand.Brand<'@kitz/effect/FileSystem/Mode'>
export declare const Mode: { make(bits: number): Mode }

/** A numeric user id. Schema-backed: `UserId.make(1000)`. */
export type UserId = number & Brand.Brand<'@kitz/effect/FileSystem/UserId'>
export declare const UserId: { make(id: number): UserId }

/** A numeric group id. Schema-backed: `GroupId.make(1000)`. */
export type GroupId = number & Brand.Brand<'@kitz/effect/FileSystem/GroupId'>
export declare const GroupId: { make(id: number): GroupId }

/** A non-negative byte count: Effect's own size type (`ByteSize` on the rc line). */
export type ByteCount = EffectFileSystem.Size

/**
 * Metadata `stat` reports, converted once into domain types: timestamps are
 * `DateTime.Utc`, ids and permissions are branded. Field names follow POSIX
 * `stat` so they read the same as the syscall.
 */
export interface Metadata {
  readonly size: ByteCount
  readonly mode: Mode
  readonly mtime: Option.Option<DateTime.Utc>
  readonly atime: Option.Option<DateTime.Utc>
  readonly birthtime: Option.Option<DateTime.Utc>
  readonly dev: number
  readonly ino: Option.Option<number>
  readonly nlink: Option.Option<number>
  readonly uid: Option.Option<UserId>
  readonly gid: Option.Option<GroupId>
  readonly rdev: Option.Option<number>
  readonly blksize: Option.Option<ByteCount>
  readonly blocks: Option.Option<number>
}

// ─── Filesystem truth (law 5: intent and truth stay distinct) ───────────────

/**
 * What `stat` learned about an entry. The tag is the host kind; the path is
 * re-classified by that evidence, so only `Directory` carries a directory path.
 * `$World` is the input's anchoring.
 *
 * Classification follows symbolic links: that is Effect's `stat`, and the
 * upstream service offers no `lstat`, so a `SymbolicLink` kind is never
 * observable in 0.1.0 and is not modelled.
 */
export type Info<$World extends World = World> = Data.TaggedEnum<{
  File: { readonly path: FileOf<$World> } & Metadata
  Directory: { readonly path: DirOf<$World> } & Metadata
  BlockDevice: { readonly path: FileOf<$World> } & Metadata
  CharacterDevice: { readonly path: FileOf<$World> } & Metadata
  FIFO: { readonly path: FileOf<$World> } & Metadata
  Socket: { readonly path: FileOf<$World> } & Metadata
  Unknown: { readonly path: FileOf<$World> } & Metadata
}>

/**
 * A directory child, classified the same way as {@link Info} but without its
 * metadata. `Unresolved` is a child the listing reported whose target could not
 * be resolved: a dangling or looping symbolic link, or an entry removed between
 * listing and classification.
 */
export type Entry<$World extends World = World> = Data.TaggedEnum<{
  File: { readonly path: FileOf<$World> }
  Directory: { readonly path: DirOf<$World> }
  BlockDevice: { readonly path: FileOf<$World> }
  CharacterDevice: { readonly path: FileOf<$World> }
  FIFO: { readonly path: FileOf<$World> }
  Socket: { readonly path: FileOf<$World> }
  Unknown: { readonly path: FileOf<$World> }
  Unresolved: { readonly path: FileOf<$World> }
}>

/** A child named without claiming its kind, for results no safe `stat` can classify. */
export interface EntryAddress<$Parent extends Path.Dir = Path.Dir> {
  readonly parent: $Parent
  readonly name: Path.Segment
}

/** A watch notification. Its address stays kind-erased: a removed entry cannot be stat-classified. */
export type WatchEvent<$Parent extends Path.Dir = Path.Dir> = Data.TaggedEnum<{
  Create: { readonly address: EntryAddress<$Parent> }
  Update: { readonly address: EntryAddress<$Parent> }
  Remove: { readonly address: EntryAddress<$Parent> }
}>

// ─── Links and globs: their own grammars, not Path values ───────────────────

/**
 * A symbolic link's stored target: absolute or relative, component sequence
 * kept verbatim (`.` and `..` included), terminal kind unknown. Deliberately not
 * a `Path` value — normalizing across a link can change what it resolves to.
 */
export type LinkTarget = string & Brand.Brand<'@kitz/effect/FileSystem/LinkTarget'>
export declare const LinkTarget: {
  make<const $S extends string>(target: LinkTargetLiteralGuard<$S>): LinkTarget
}

type LinkTargetLiteralGuard<$S extends string> =
  Types.IsLiteral<$S> extends true
    ? $S extends ''
      ? Types.StaticError<'Link target cannot be empty'>
      : $S extends `${string}\0${string}`
        ? Types.StaticError<'Link target cannot contain NUL'>
        : $S
    : Types.StaticError<'FileSystem link targets require a literal; decode dynamic strings through FileSystem.LinkTarget'>

type LinkTargetArg<$T> = $T extends LinkTarget
  ? $T
  : $T extends string
    ? LinkTargetLiteralGuard<$T>
    : never

/**
 * A glob pattern, always relative: results anchor to the operation's `root`
 * directory, so absolute patterns are rejected rather than silently re-rooted.
 */
export type Glob = string & Brand.Brand<'@kitz/effect/FileSystem/Glob'>
export declare const Glob: {
  make<const $S extends string>(pattern: GlobLiteralGuard<$S>): Glob
}

type GlobLiteralGuard<$S extends string> =
  Types.IsLiteral<$S> extends true
    ? $S extends ''
      ? Types.StaticError<'Glob pattern cannot be empty'>
      : $S extends `/${string}`
        ? Types.StaticError<'Glob patterns are root-relative; pass the anchor as the `root` option'>
        : $S extends `${string}\0${string}`
          ? Types.StaticError<'Glob pattern cannot contain NUL'>
          : $S
    : Types.StaticError<'FileSystem glob patterns require a literal; decode dynamic strings through FileSystem.Glob'>

type GlobArg<$G> = $G extends Glob ? $G : $G extends string ? GlobLiteralGuard<$G> : never

// ─── Capability-indexed handles ─────────────────────────────────────────────

/** Effect's POSIX open flags, used verbatim: `'r'`, `'r+'`, `'w'`, `'wx'`, `'w+'`, `'wx+'`, `'a'`, `'ax'`, `'a+'`, `'ax+'`. */
export type OpenFlag = EffectFileSystem.OpenFlag

/** What an open handle may do. */
export type Capability = 'read' | 'write' | 'append'

/** The capabilities each open flag grants. */
export type CapabilitiesOf<$Flag extends OpenFlag> = {
  r: 'read'
  'r+': 'read' | 'write'
  w: 'write'
  wx: 'write'
  'w+': 'read' | 'write'
  'wx+': 'read' | 'write'
  a: 'append'
  ax: 'append'
  'a+': 'read' | 'append'
  'ax+': 'read' | 'append'
}[$Flag]

interface HandleCore<$File extends Path.File> {
  readonly path: $File
  readonly stat: Effect.Effect<Info<WorldOf<$File>>, PlatformError>
  /** Move the cursor. Seeking before the start fails; `'current'` offsets may be negative. */
  seek(offset: bigint, from: EffectFileSystem.SeekMode): Effect.Effect<bigint, PlatformError>
}

interface HandleReadable {
  read(buffer: Uint8Array): Effect.Effect<number, PlatformError>
  readAlloc(size: number): Effect.Effect<Option.Option<Uint8Array>, PlatformError>
}

interface HandleWritable {
  write(buffer: Uint8Array): Effect.Effect<number, PlatformError>
  writeAll(buffer: Uint8Array): Effect.Effect<void, PlatformError>
  truncate(length?: ByteCount): Effect.Effect<void, PlatformError>
  readonly sync: Effect.Effect<void, PlatformError>
}

/**
 * An open file whose methods are exactly its capabilities: a read-only handle
 * has no writes, a write-only handle has no reads, and append handles write at
 * the end regardless of the cursor.
 */
export type Handle<
  $Capability extends Capability = Capability,
  $File extends Path.File = Path.File,
> = HandleCore<$File> &
  ('read' extends $Capability ? HandleReadable : unknown) &
  ([Exclude<$Capability, 'read'>] extends [never] ? unknown : HandleWritable)

// ─── Errors (law 6) ─────────────────────────────────────────────────────────

/**
 * A path string the host reported that is not a valid Kitz path. Typed failure,
 * never a defect or a cast. In practice Node never produces one; the channel
 * exists so the conversion is total.
 */
export interface PathError {
  readonly _tag: '@kitz/effect/FileSystem/PathError'
  readonly method: string
  readonly path: string
  readonly cause: unknown
}

// ─── Options ────────────────────────────────────────────────────────────────

export interface AccessOptions {
  readonly readable?: boolean
  readonly writable?: boolean
}

export interface WriteOptions {
  /** Fail with `AlreadyExists` instead of replacing an existing file (`'wx'`). */
  readonly exclusive?: boolean
  readonly mode?: Mode
}

export interface AppendOptions {
  readonly mode?: Mode
}

export interface StreamOptions {
  readonly offset?: ByteCount
  readonly bytesToRead?: ByteCount
  readonly chunkSize?: number
}

export interface SinkOptions {
  readonly flag?: Exclude<OpenFlag, 'r'>
  readonly mode?: Mode
}

/**
 * How `copy` treats an existing destination. `existing` is required: there is
 * no implicit default (Effect's is a silent skip, `cp`'s is replace). Pre-apply
 * a policy once with `copyWith`.
 */
export interface CopyPolicy {
  readonly existing: 'replace' | 'skip'
  readonly preserveTimestamps?: boolean
}

/** File removal cannot request recursion; directory removal can. */
export type RemoveOptions<$Path> = $Path extends Path.Dir
  ? { readonly recursive?: boolean; readonly force?: boolean }
  : { readonly force?: boolean }

export interface Times {
  readonly accessed: DateTime.Utc
  readonly modified: DateTime.Utc
}

export interface Owner {
  readonly user: UserId
  readonly group: GroupId
}

// ─── Component literals (Path's `withName` precedent) ──────────────────────

/** A segment position: a decoded `Path.Segment`, or a literal the segment grammar accepts. */
type SegmentArg<$S, $Op extends string> = $S extends Path.Segment
  ? $S
  : $S extends string
    ? SegmentLiteralGuard<$S, `FileSystem.${$Op}`>
    : never

/** Each glob position in a tuple validated independently, so a diagnostic lands on the offending element. */
type GlobArgs<$Globs extends ReadonlyArray<Glob | string>> = {
  readonly [$Index in keyof $Globs]: GlobArg<$Globs[$Index]>
}

// ─── Curried forms (kitz `*With`: configuration first, data last) ───────────

/**
 * Currying rule: an operation whose trailing required parameter configures it
 * (an open flag, a copy policy, a codec, a mode, an owner, timestamps) also
 * exports `<op>With(config)`, returning the operation over its data. Named
 * intents are `*With` pre-applications. Operations whose remaining parameters
 * are data (bytes, text) or optional options have no curried form.
 */
interface OpenFile<$Flag extends OpenFlag, $R> {
  <const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'open'>,
  ): Effect.Effect<
    Handle<CapabilitiesOf<$Flag>, PathOf<$F, Path.File>>,
    PlatformError,
    $R | Scope.Scope
  >
}

interface CopyEntries<$R> {
  <const $From extends Path.Any | string, const $To extends Path.Any | string>(
    from: PathArg<$From, Path.Any, 'copy'>,
    to: KindArg<$To, PathOf<$From, Path.Any>, 'copy'>,
  ): Effect.Effect<void, PlatformError, $R>
}

interface DecodeFile<$A, $RD, $R> {
  <const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'decode'>,
  ): Effect.Effect<$A, PlatformError | Schema.SchemaError, $R | $RD>
}

interface EncodeFile<$A, $RE, $R> {
  <const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'encode'>,
    value: $A,
    options?: WriteOptions,
  ): Effect.Effect<void, PlatformError | Schema.SchemaError, $R | $RE>
}

interface UpdateEntry<$Op extends string, $R> {
  <const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, $Op>,
  ): Effect.Effect<void, PlatformError, $R>
}

// ─── Operations ─────────────────────────────────────────────────────────────

/**
 * Every operation, parameterized by its requirements. The top-level operations
 * require {@link Service}; {@link Api} (yielded by {@link service}) has them
 * discharged. One declaration serves both, so the literal-duality generics are
 * never collapsed by a signature transform.
 */
interface Operations<$R> {
  // access
  exists<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'exists'>,
  ): Effect.Effect<boolean, PlatformError, $R>
  access<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'access'>,
    options?: AccessOptions,
  ): Effect.Effect<void, PlatformError, $R>

  // bytes and text
  read<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'read'>,
  ): Effect.Effect<Uint8Array, PlatformError, $R>
  readString<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'readString'>,
    options?: { readonly encoding?: string },
  ): Effect.Effect<string, PlatformError, $R>
  write<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'write'>,
    bytes: Uint8Array,
    options?: WriteOptions,
  ): Effect.Effect<void, PlatformError, $R>
  writeString<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'writeString'>,
    text: string,
    options?: WriteOptions,
  ): Effect.Effect<void, PlatformError, $R>
  append<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'append'>,
    bytes: Uint8Array,
    options?: AppendOptions,
  ): Effect.Effect<void, PlatformError, $R>
  appendString<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'appendString'>,
    text: string,
    options?: AppendOptions,
  ): Effect.Effect<void, PlatformError, $R>

  // codecs (law 7): content types come from an explicit Schema codec, never an
  // extension. A codec's encoded side decides the transport: `string` codecs read
  // and write UTF-8 text, `Uint8Array` codecs read and write bytes.
  decode<const $F extends Path.File | string, $A, $Encoded extends string | Uint8Array, $RD>(
    file: PathArg<$F, Path.File, 'decode'>,
    codec: Schema.Codec<$A, $Encoded, $RD, unknown>,
  ): Effect.Effect<$A, PlatformError | Schema.SchemaError, $R | $RD>
  decodeWith<$A, $Encoded extends string | Uint8Array, $RD>(
    codec: Schema.Codec<$A, $Encoded, $RD, unknown>,
  ): DecodeFile<$A, $RD, $R>
  encode<const $F extends Path.File | string, $A, $Encoded extends string | Uint8Array, $RE>(
    file: PathArg<$F, Path.File, 'encode'>,
    codec: Schema.Codec<$A, $Encoded, unknown, $RE>,
    value: $A,
    options?: WriteOptions,
  ): Effect.Effect<void, PlatformError | Schema.SchemaError, $R | $RE>
  encodeWith<$A, $Encoded extends string | Uint8Array, $RE>(
    codec: Schema.Codec<$A, $Encoded, unknown, $RE>,
  ): EncodeFile<$A, $RE, $R>

  // handles: the flag is required; the named intents pre-apply the common ones
  open<const $F extends Path.File | string, const $Flag extends OpenFlag>(
    file: PathArg<$F, Path.File, 'open'>,
    flag: $Flag,
    options?: { readonly mode?: Mode },
  ): Effect.Effect<
    Handle<CapabilitiesOf<$Flag>, PathOf<$F, Path.File>>,
    PlatformError,
    $R | Scope.Scope
  >
  openWith<const $Flag extends OpenFlag>(
    flag: $Flag,
    options?: { readonly mode?: Mode },
  ): OpenFile<$Flag, $R>
  /** `openWith('r')`: read an existing file. */
  openRead<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'openRead'>,
  ): Effect.Effect<Handle<'read', PathOf<$F, Path.File>>, PlatformError, $R | Scope.Scope>
  /** `openWith('r+')`: read and write an existing file in place — no truncation, no creation. */
  openReadWrite<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'openReadWrite'>,
  ): Effect.Effect<Handle<'read' | 'write', PathOf<$F, Path.File>>, PlatformError, $R | Scope.Scope>
  /** `openWith('w')`: write from empty, creating or truncating. */
  openWrite<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'openWrite'>,
  ): Effect.Effect<Handle<'write', PathOf<$F, Path.File>>, PlatformError, $R | Scope.Scope>
  /** `openWith('a')`: append, creating if absent. */
  openAppend<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'openAppend'>,
  ): Effect.Effect<Handle<'append', PathOf<$F, Path.File>>, PlatformError, $R | Scope.Scope>

  // streaming
  stream<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'stream'>,
    options?: StreamOptions,
  ): Stream.Stream<Uint8Array, PlatformError, $R>
  sink<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'sink'>,
    options?: SinkOptions,
  ): Sink.Sink<void, Uint8Array, never, PlatformError, $R>
  truncate<const $F extends Path.File | string>(
    file: PathArg<$F, Path.File, 'truncate'>,
    length?: ByteCount,
  ): Effect.Effect<void, PlatformError, $R>

  // directories
  makeDirectory<const $D extends Path.Dir | string>(
    dir: PathArg<$D, Path.Dir, 'makeDirectory'>,
    options?: { readonly recursive?: boolean; readonly mode?: Mode },
  ): Effect.Effect<void, PlatformError, $R>
  /** Immediate child names — no metadata work. */
  readDirectoryNames<const $D extends Path.Dir | string>(
    dir: PathArg<$D, Path.Dir, 'readDirectoryNames'>,
  ): Effect.Effect<ReadonlyArray<Path.Segment>, PlatformError | PathError, $R>
  /** Children (or, with `recursive`, all descendants) as classified entries anchored like `dir`. */
  readDirectory<const $D extends Path.Dir | string>(
    dir: PathArg<$D, Path.Dir, 'readDirectory'>,
    options?: { readonly recursive?: boolean },
  ): Effect.Effect<
    ReadonlyArray<Entry<WorldOf<PathOf<$D, Path.Dir>>>>,
    PlatformError | PathError,
    $R
  >

  // metadata
  stat<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'stat'>,
  ): Effect.Effect<Info<WorldOf<PathOf<$P, Path.Any>>>, PlatformError, $R>
  /** The canonical absolute path, classified by the resolved target's kind. */
  realPath<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'realPath'>,
  ): Effect.Effect<Path.Abs, PlatformError | PathError, $R>

  // links
  readLink<const $L extends Path.File | string>(
    link: PathArg<$L, Path.File, 'readLink'>,
  ): Effect.Effect<LinkTarget, PlatformError, $R>
  symbolicLink<const $T extends LinkTarget | string, const $L extends Path.File | string>(
    target: LinkTargetArg<$T>,
    link: PathArg<$L, Path.File, 'symbolicLink'>,
  ): Effect.Effect<void, PlatformError, $R>
  hardLink<const $E extends Path.File | string, const $L extends Path.File | string>(
    existing: PathArg<$E, Path.File, 'hardLink'>,
    link: PathArg<$L, Path.File, 'hardLink'>,
  ): Effect.Effect<void, PlatformError, $R>

  // movement: file-to-file or directory-to-directory
  copy<const $From extends Path.Any | string, const $To extends Path.Any | string>(
    from: PathArg<$From, Path.Any, 'copy'>,
    to: KindArg<$To, PathOf<$From, Path.Any>, 'copy'>,
    policy: CopyPolicy,
  ): Effect.Effect<void, PlatformError, $R>
  copyWith(policy: CopyPolicy): CopyEntries<$R>
  rename<const $From extends Path.Any | string, const $To extends Path.Any | string>(
    from: PathArg<$From, Path.Any, 'rename'>,
    to: KindArg<$To, PathOf<$From, Path.Any>, 'rename'>,
  ): Effect.Effect<void, PlatformError, $R>

  // removal
  remove<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'remove'>,
    options?: RemoveOptions<PathOf<$P, Path.Any>>,
  ): Effect.Effect<void, PlatformError, $R>

  // permissions, ownership, timestamps
  chmod<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'chmod'>,
    mode: Mode,
  ): Effect.Effect<void, PlatformError, $R>
  chmodWith(mode: Mode): UpdateEntry<'chmod', $R>
  chown<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'chown'>,
    owner: Owner,
  ): Effect.Effect<void, PlatformError, $R>
  chownWith(owner: Owner): UpdateEntry<'chown', $R>
  utimes<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'utimes'>,
    times: Times,
  ): Effect.Effect<void, PlatformError, $R>
  utimesWith(times: Times): UpdateEntry<'utimes', $R>

  // temporary entries: anchored like `directory` (absolute when omitted)
  makeTempDirectory<
    const $D extends Path.Dir | string = Path.AbsDir,
    const $Prefix extends Path.Segment | string = Path.Segment,
  >(options?: {
    readonly directory?: PathArg<$D, Path.Dir, 'makeTempDirectory'>
    readonly prefix?: SegmentArg<$Prefix, 'makeTempDirectory'>
  }): Effect.Effect<DirOf<WorldOf<PathOf<$D, Path.Dir>>>, PlatformError | PathError, $R>
  makeTempDirectoryScoped<
    const $D extends Path.Dir | string = Path.AbsDir,
    const $Prefix extends Path.Segment | string = Path.Segment,
  >(options?: {
    readonly directory?: PathArg<$D, Path.Dir, 'makeTempDirectoryScoped'>
    readonly prefix?: SegmentArg<$Prefix, 'makeTempDirectoryScoped'>
  }): Effect.Effect<
    DirOf<WorldOf<PathOf<$D, Path.Dir>>>,
    PlatformError | PathError,
    $R | Scope.Scope
  >
  /** The file gets a random name plus `suffix`. Upstream spends `prefix` on a hidden parent directory, so it is not offered. */
  makeTempFile<
    const $D extends Path.Dir | string = Path.AbsDir,
    const $Suffix extends Path.Segment | string = Path.Segment,
  >(options?: {
    readonly directory?: PathArg<$D, Path.Dir, 'makeTempFile'>
    readonly suffix?: SegmentArg<$Suffix, 'makeTempFile'>
  }): Effect.Effect<FileOf<WorldOf<PathOf<$D, Path.Dir>>>, PlatformError | PathError, $R>
  makeTempFileScoped<
    const $D extends Path.Dir | string = Path.AbsDir,
    const $Suffix extends Path.Segment | string = Path.Segment,
  >(options?: {
    readonly directory?: PathArg<$D, Path.Dir, 'makeTempFileScoped'>
    readonly suffix?: SegmentArg<$Suffix, 'makeTempFileScoped'>
  }): Effect.Effect<
    FileOf<WorldOf<PathOf<$D, Path.Dir>>>,
    PlatformError | PathError,
    $R | Scope.Scope
  >

  // discovery: entries anchored to `root` (the process cwd, relative, when omitted)
  glob<
    const $G extends Glob | string,
    const $Root extends Path.Dir | string = Path.RelDir,
    const $Exclude extends ReadonlyArray<Glob | string> = [],
  >(
    pattern: GlobArg<$G>,
    options?: {
      readonly root?: PathArg<$Root, Path.Dir, 'glob'>
      readonly exclude?: GlobArgs<$Exclude>
    },
  ): Effect.Effect<
    ReadonlyArray<Entry<WorldOf<PathOf<$Root, Path.Dir>>>>,
    PlatformError | PathError,
    $R
  >

  // observation
  watch<const $P extends Path.Any | string>(
    path: PathArg<$P, Path.Any, 'watch'>,
    options?: { readonly recursive?: boolean },
  ): Stream.Stream<WatchEvent<DirOf<WorldOf<PathOf<$P, Path.Any>>>>, PlatformError | PathError, $R>
}

/** The typed surface with the service already bound. Yield it with {@link service}. */
export interface Api extends Operations<never> {}

/** A view over Effect's service — an `Effect`, not a tag. Nothing ever provides it. */
export declare const service: Effect.Effect<Api, never, Service>

export declare const exists: Operations<Service>['exists']
export declare const access: Operations<Service>['access']
export declare const read: Operations<Service>['read']
export declare const readString: Operations<Service>['readString']
export declare const write: Operations<Service>['write']
export declare const writeString: Operations<Service>['writeString']
export declare const append: Operations<Service>['append']
export declare const appendString: Operations<Service>['appendString']
export declare const decode: Operations<Service>['decode']
export declare const decodeWith: Operations<Service>['decodeWith']
export declare const encode: Operations<Service>['encode']
export declare const encodeWith: Operations<Service>['encodeWith']
export declare const open: Operations<Service>['open']
export declare const openWith: Operations<Service>['openWith']
export declare const openRead: Operations<Service>['openRead']
export declare const openReadWrite: Operations<Service>['openReadWrite']
export declare const openWrite: Operations<Service>['openWrite']
export declare const openAppend: Operations<Service>['openAppend']
export declare const stream: Operations<Service>['stream']
export declare const sink: Operations<Service>['sink']
export declare const truncate: Operations<Service>['truncate']
export declare const makeDirectory: Operations<Service>['makeDirectory']
export declare const readDirectoryNames: Operations<Service>['readDirectoryNames']
export declare const readDirectory: Operations<Service>['readDirectory']
export declare const stat: Operations<Service>['stat']
export declare const realPath: Operations<Service>['realPath']
export declare const readLink: Operations<Service>['readLink']
export declare const symbolicLink: Operations<Service>['symbolicLink']
export declare const hardLink: Operations<Service>['hardLink']
export declare const copy: Operations<Service>['copy']
export declare const copyWith: Operations<Service>['copyWith']
export declare const rename: Operations<Service>['rename']
export declare const remove: Operations<Service>['remove']
export declare const chmod: Operations<Service>['chmod']
export declare const chmodWith: Operations<Service>['chmodWith']
export declare const chown: Operations<Service>['chown']
export declare const chownWith: Operations<Service>['chownWith']
export declare const utimes: Operations<Service>['utimes']
export declare const utimesWith: Operations<Service>['utimesWith']
export declare const makeTempDirectory: Operations<Service>['makeTempDirectory']
export declare const makeTempDirectoryScoped: Operations<Service>['makeTempDirectoryScoped']
export declare const makeTempFile: Operations<Service>['makeTempFile']
export declare const makeTempFileScoped: Operations<Service>['makeTempFileScoped']
export declare const glob: Operations<Service>['glob']
export declare const watch: Operations<Service>['watch']
