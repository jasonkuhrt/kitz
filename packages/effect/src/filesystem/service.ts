import { Context, Effect, FileSystem as Platform, Layer, Sink, Stream } from 'effect'
import * as ops from './filesystem.js'

/**
 * Remove effect's platform `FileSystem` requirement from an operation's effect
 * channel (the service layer captures it once). `Scope` requirements are preserved.
 */
type Discharge<T> = T extends (...args: infer A) => Effect.Effect<infer O, infer E, infer R>
  ? (...args: A) => Effect.Effect<O, E, Exclude<R, Platform.FileSystem>>
  : T extends (...args: infer A) => Stream.Stream<infer O, infer E, infer R>
    ? (...args: A) => Stream.Stream<O, E, Exclude<R, Platform.FileSystem>>
    : T extends (...args: infer A) => Sink.Sink<infer O, infer I, infer L, infer E, infer R>
      ? (...args: A) => Sink.Sink<O, I, L, E, Exclude<R, Platform.FileSystem>>
      : T

/**
 * Shape of the {@link FileSystem} service: every typed-path operation in this
 * package with effect's platform `FileSystem` requirement already discharged.
 *
 * The overloaded dispatchers (`read`, `write`, `rename`) collapse to their broad
 * signatures here — TypeScript cannot carry overloads through a type transform.
 * For full file-vs-directory dispatch, call the free functions (`FileSystem.read`,
 * …), which retain their overloads.
 */
export type FileSystemService = {
  [K in keyof typeof ops]: Discharge<(typeof ops)[K]>
}

/**
 * `FileSystem` service — this package's typed-path filesystem operations as one
 * injectable service, built over effect's platform `FileSystem`. Mirrors effect's
 * `FileSystem.FileSystem` (and supersedes it for `@kitz/effect` consumers).
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { FileSystem, Path } from '@kitz/effect'
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* fs.readString(Path.AbsFile.fromString('/etc/hostname'))
 * }).pipe(
 *   Effect.provide(FileSystem.FileSystem.layer),
 *   Effect.provide(FileSystem.Memory.layer({ '/etc/hostname': 'localhost' })),
 * )
 * ```
 */
export class FileSystem extends Context.Service<FileSystem, FileSystemService>()(
  '@kitz/effect/FileSystem',
) {
  /**
   * Layer providing the service over effect's platform `FileSystem`. Compose with
   * a backing layer — `FileSystem.Memory.layer(…)` for tests, or a platform layer
   * such as `@effect/platform-node`'s `NodeFileSystem.layer`.
   */
  static layer: Layer.Layer<FileSystem, never, Platform.FileSystem> = Layer.effect(
    FileSystem,
    Effect.gen(function* () {
      const fs = yield* Platform.FileSystem
      const giveFs = Effect.provideService(Platform.FileSystem)(fs)
      const giveFsStream = Stream.provideService(Platform.FileSystem, fs)
      const giveFsSink = Sink.provideService(Platform.FileSystem, fs)
      // Loose view over the free functions: keys stay checked, call sites forward
      // verbatim. The service's precise types come from the `FileSystemService`
      // annotation; runtime correctness is the free functions'.
      const o = ops as { [K in keyof typeof ops]: (...args: any[]) => any }
      const impl: FileSystemService = {
        exists: (loc) => giveFs(o.exists(loc)),
        access: (loc, options) => giveFs(o.access(loc, options)),
        chmod: (loc, mode) => giveFs(o.chmod(loc, mode)),
        chown: (loc, uid, gid) => giveFs(o.chown(loc, uid, gid)),
        open: (loc, options) => giveFs(o.open(loc, options)),
        read: (loc, options) => giveFs(o.read(loc, options)),
        readString: (loc, encoding) => giveFs(o.readString(loc, encoding)),
        readLink: (loc) => giveFs(o.readLink(loc)),
        realPath: (loc) => giveFs(o.realPath(loc)),
        clear: (loc) => giveFs(o.clear(loc)),
        remove: (loc, options) => giveFs(o.remove(loc, options)),
        sink: (loc, options) => giveFsSink(o.sink(loc, options)),
        stat: (loc) => giveFs(o.stat(loc)),
        stream: (loc, options) => giveFsStream(o.stream(loc, options)),
        truncate: (loc, length) => giveFs(o.truncate(loc, length)),
        utimes: (loc, atime, mtime) => giveFs(o.utimes(loc, atime, mtime)),
        watch: (loc) => giveFsStream(o.watch(loc)),
        write: (...args) => giveFs(o.write(...args)),
        writeString: (loc, data, options) => giveFs(o.writeString(loc, data, options)),
        copy: (from, to, options) => giveFs(o.copy(from, to, options)),
        link: (from, to) => giveFs(o.link(from, to)),
        rename: (...args) => giveFs(o.rename(...args)),
        symlink: (from, to) => giveFs(o.symlink(from, to)),
        makeTempDirectory: (options) => giveFs(o.makeTempDirectory(options)),
        makeTempDirectoryScoped: (options) => giveFs(o.makeTempDirectoryScoped(options)),
        makeTemp: (options) => giveFs(o.makeTemp(options)),
        makeTempScoped: (options) => giveFs(o.makeTempScoped(options)),
      }
      return impl
    }),
  )
}
