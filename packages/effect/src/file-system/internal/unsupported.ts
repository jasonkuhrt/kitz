import * as Effect from 'effect/Effect'
import * as PlatformError from 'effect/PlatformError'
import * as Stream from 'effect/Stream'

// `Unsupported` is not in effect's `SystemErrorTag` vocabulary (AlreadyExists |
// BadResource | Busy | InvalidData | NotFound | PermissionDenied | TimedOut |
// UnexpectedEof | Unknown | WouldBlock | WriteZero), so an unimplemented slot
// reports `Unknown` with an explicit description. It must never report
// `NotFound` — that is a truthful answer to a different question, and it is
// exactly what `FileSystem.makeNoop` does, silently turning "not implemented"
// into "the path is absent".
const unsupportedError = (method: string): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: 'Unknown',
    module: 'FileSystem',
    method,
    description: `the in-memory FileSystem does not implement \`${method}\``,
  })

const unsupported = (method: string): Effect.Effect<never, PlatformError.PlatformError> =>
  Effect.fail(unsupportedError(method))

const unsupportedStream = (method: string): Stream.Stream<never, PlatformError.PlatformError> =>
  Stream.fail(unsupportedError(method))

/**
 * The upstream primitives the in-memory backend has not implemented yet — every
 * slot `FileSystem.make` requires except `access`, which the inode graph owns.
 *
 * Each fails loudly rather than inheriting noop behavior, so a horizontal slice
 * that reaches for an unbuilt operation is an error at the call site instead of
 * a plausible-looking wrong answer. Slots leave this object one at a time as the
 * graph grows real primitives.
 *
 * The stubs take no parameters: a nullary function is assignable to any of these
 * signatures, so each slot stays exactly one line and no argument list has to be
 * kept in sync with upstream.
 */
export const unsupportedPrimitives = {
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
  watch: () => unsupportedStream('watch'),
  writeFile: () => unsupported('writeFile'),
}
