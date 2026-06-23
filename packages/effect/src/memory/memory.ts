/**
 * In-memory `FileSystem` layer backed by a directly-used `@platformatic/vfs`
 * `VirtualFileSystem` (MemoryProvider).
 *
 * The vfs is **not** mounted, so `node:fs` is never patched — the in-memory
 * filesystem is scoped to this layer and hermetic (only code provided with this
 * layer sees it). The effect `FileSystem` service is built with `FileSystem.make`,
 * which derives `exists`/`readFileString`/`writeFileString`/`stream`/`sink` from
 * the primitives implemented here.
 *
 * `@platformatic/vfs` provides correct filesystem semantics (real `stat`, recursive
 * directories, symlinks); operations it lacks natively (recursive remove/copy,
 * `truncate`) are emulated, and metadata ops it does not model (`chmod`/`chown`/
 * `utimes`) are no-ops. It is the userland extraction of Node core's `node:vfs`;
 * see `./vfs.ts`.
 */
import { Effect, FileSystem, Layer, Option, PlatformError, Stream } from 'effect'
import { create as createVfs, type VfsStats, type VirtualFileSystem } from './vfs.js'

/**
 * Memory filesystem disk layout specification.
 * Keys are file paths, values are file contents as strings or `Uint8Array`.
 *
 * @example
 * ```ts
 * const diskLayout: DiskLayout = {
 *   '/config.json': '{"version": "1.0.0"}',
 *   '/src/index.js': 'console.log("Hello")',
 * }
 * ```
 */
export interface DiskLayout {
  [path: string]: string | Uint8Array
}

// ── error + stat mapping ─────────────────────────────────────────────────────

const tagForCode = (code: unknown): PlatformError.SystemErrorTag => {
  switch (code) {
    case 'ENOENT':
      return 'NotFound'
    case 'EEXIST':
      return 'AlreadyExists'
    case 'EACCES':
    case 'EPERM':
      return 'PermissionDenied'
    case 'ENOTDIR':
    case 'EISDIR':
    case 'EINVAL':
    case 'ENOTEMPTY':
      return 'InvalidData'
    case 'EBUSY':
      return 'Busy'
    default:
      return 'Unknown'
  }
}

const toError = (method: string, path: string, cause: unknown) =>
  PlatformError.systemError({
    _tag: tagForCode((cause as { code?: unknown } | null | undefined)?.code),
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
    description: (cause as { message?: string } | null | undefined)?.message ?? String(cause),
    cause,
  })

const attempt = <A>(method: string, path: string, run: () => A) =>
  Effect.try({ try: run, catch: (cause) => toError(method, path, cause) })

const toInfo = (s: VfsStats): FileSystem.File.Info => ({
  type: s.isFile()
    ? 'File'
    : s.isDirectory()
      ? 'Directory'
      : s.isSymbolicLink()
        ? 'SymbolicLink'
        : s.isBlockDevice()
          ? 'BlockDevice'
          : s.isCharacterDevice()
            ? 'CharacterDevice'
            : s.isFIFO()
              ? 'FIFO'
              : s.isSocket()
                ? 'Socket'
                : 'Unknown',
  mtime: Option.some(s.mtime),
  atime: Option.some(s.atime),
  birthtime: Option.some(s.birthtime),
  dev: s.dev,
  ino: Option.some(s.ino),
  mode: s.mode,
  nlink: Option.some(s.nlink),
  uid: Option.some(s.uid),
  gid: Option.some(s.gid),
  rdev: Option.some(s.rdev),
  size: FileSystem.Size(s.size),
  blksize: Option.some(FileSystem.Size(s.blksize)),
  blocks: Option.some(s.blocks),
})

// ── path helpers ─────────────────────────────────────────────────────────────

const joinPath = (dir: string, name: string): string =>
  dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`

const parentDir = (path: string): string => {
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}

/** Recursively list all descendant entries of `dir`, as paths relative to it. */
const walkRelative = (vfs: VirtualFileSystem, dir: string): Array<string> => {
  const out: Array<string> = []
  const recur = (relBase: string, absBase: string): void => {
    for (const name of vfs.readdirSync(absBase)) {
      const rel = relBase ? `${relBase}/${name}` : name
      out.push(rel)
      const abs = joinPath(absBase, name)
      if (vfs.statSync(abs).isDirectory()) recur(rel, abs)
    }
  }
  recur('', dir)
  return out
}

/** Recursively remove a path (vfs has no `rmSync` and `rmdirSync` is not recursive). */
const removeRecursive = (vfs: VirtualFileSystem, path: string): void => {
  if (vfs.lstatSync(path).isDirectory()) {
    for (const name of vfs.readdirSync(path)) removeRecursive(vfs, joinPath(path, name))
    vfs.rmdirSync(path)
  } else {
    vfs.unlinkSync(path)
  }
}

/** Recursively copy a path (vfs has no `cpSync`). */
const copyRecursive = (vfs: VirtualFileSystem, from: string, to: string): void => {
  if (vfs.statSync(from).isDirectory()) {
    vfs.mkdirSync(to, { recursive: true })
    for (const name of vfs.readdirSync(from))
      copyRecursive(vfs, joinPath(from, name), joinPath(to, name))
  } else {
    vfs.copyFileSync(from, to)
  }
}

let tempCounter = 0
const makeTemp = (
  vfs: VirtualFileSystem,
  kind: 'directory' | 'file',
  options?: {
    readonly directory?: string | undefined
    readonly prefix?: string | undefined
    readonly suffix?: string | undefined
  },
): string => {
  const base = options?.directory ?? '/tmp'
  vfs.mkdirSync(base, { recursive: true })
  const suffix = kind === 'file' ? (options?.suffix ?? '') : ''
  tempCounter += 1
  const path = joinPath(base, `${options?.prefix ?? ''}${tempCounter}${suffix}`)
  if (kind === 'directory') vfs.mkdirSync(path)
  else vfs.writeFileSync(path, new Uint8Array(0))
  return path
}

/**
 * Build an effect `File` handle over a vfs file descriptor. Reads use the fd
 * directly; writes are emulated (vfs exposes no fd-level write) via positioned
 * read-modify-`writeFileSync`, which is enough to back `stream`/`sink`.
 */
const makeFileHandle = (vfs: VirtualFileSystem, path: string, fd: number): FileSystem.File => {
  let position = 0
  const overwriteAt = (buffer: Uint8Array): void => {
    const current = vfs.existsSync(path) ? vfs.readFileSync(path) : new Uint8Array(0)
    const end = position + buffer.length
    const next = new Uint8Array(Math.max(current.length, end))
    next.set(current)
    next.set(buffer, position)
    position = end
    vfs.writeFileSync(path, next)
  }
  return {
    [FileSystem.FileTypeId]: FileSystem.FileTypeId,
    fd: FileSystem.FileDescriptor(fd),
    stat: attempt('stat', path, () => toInfo(vfs.fstatSync(fd))),
    seek: (offset, from) =>
      Effect.sync(() => {
        position = from === 'current' ? position + Number(offset) : Number(offset)
      }),
    sync: Effect.void,
    read: (buffer) =>
      attempt('read', path, () => {
        const bytes = vfs.readSync(fd, buffer, 0, buffer.length, position)
        position += bytes
        return FileSystem.Size(bytes)
      }),
    readAlloc: (size) =>
      attempt('read', path, () => {
        const buffer = new Uint8Array(Number(size))
        const bytes = vfs.readSync(fd, buffer, 0, buffer.length, position)
        position += bytes
        return bytes === 0 ? Option.none() : Option.some(buffer.subarray(0, bytes))
      }),
    truncate: (length) =>
      attempt('truncate', path, () => {
        const current = vfs.readFileSync(path)
        vfs.writeFileSync(path, current.subarray(0, Number(length ?? 0)))
      }),
    write: (buffer) =>
      attempt('write', path, () => {
        overwriteAt(buffer)
        return FileSystem.Size(buffer.length)
      }),
    writeAll: (buffer) => attempt('write', path, () => overwriteAt(buffer)),
  }
}

// ── layer ────────────────────────────────────────────────────────────────────

/**
 * Creates a memory filesystem layer from a disk layout specification.
 * Provides a fully functional, hermetic in-memory `FileSystem` service for testing.
 *
 * @param initialDiskLayout - Object mapping file paths to their contents
 * @returns Layer that provides a `FileSystem` service backed by memory
 *
 * @example
 * ```ts
 * import { Effect, FileSystem as EffectFileSystem } from 'effect'
 * import { FileSystem } from '@kitz/effect'
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* EffectFileSystem.FileSystem
 *   return yield* fs.readFileString('/config.json')
 * })
 *
 * Effect.runPromise(
 *   Effect.provide(program, FileSystem.Memory.layer({ '/config.json': '{"name":"test"}' })),
 * )
 * ```
 */
export const layer = (initialDiskLayout: DiskLayout) => {
  const vfs = createVfs()

  for (const [path, content] of Object.entries(initialDiskLayout)) {
    const dir = parentDir(path)
    if (dir !== '/' && dir !== '') vfs.mkdirSync(dir, { recursive: true })
    vfs.writeFileSync(path, content)
  }

  const impl = FileSystem.make({
    access: (path) => attempt('access', path, () => vfs.accessSync(path)),
    chmod: () => Effect.void,
    chown: () => Effect.void,
    copy: (fromPath, toPath) =>
      attempt('copy', fromPath, () => copyRecursive(vfs, fromPath, toPath)),
    copyFile: (fromPath, toPath) =>
      attempt('copyFile', fromPath, () => vfs.copyFileSync(fromPath, toPath)),
    link: (fromPath) =>
      Effect.fail(
        toError('link', fromPath, {
          code: 'ENOSYS',
          message: 'hard links are not supported by the in-memory filesystem',
        }),
      ),
    makeDirectory: (path, options) =>
      attempt('makeDirectory', path, () => {
        vfs.mkdirSync(path, { recursive: options?.recursive ?? false, mode: options?.mode })
      }),
    makeTempDirectory: (options) =>
      attempt('makeTempDirectory', '', () => makeTemp(vfs, 'directory', options)),
    makeTempDirectoryScoped: (options) =>
      Effect.acquireRelease(
        attempt('makeTempDirectory', '', () => makeTemp(vfs, 'directory', options)),
        (path) => Effect.ignore(attempt('remove', path, () => removeRecursive(vfs, path))),
      ),
    makeTempFile: (options) => attempt('makeTempFile', '', () => makeTemp(vfs, 'file', options)),
    makeTempFileScoped: (options) =>
      Effect.acquireRelease(
        attempt('makeTempFile', '', () => makeTemp(vfs, 'file', options)),
        (path) => Effect.ignore(attempt('remove', path, () => vfs.unlinkSync(path))),
      ),
    open: (path, options) =>
      Effect.acquireRelease(
        attempt('open', path, () => vfs.openSync(path, options?.flag ?? 'r')),
        (fd) =>
          Effect.sync(() => {
            try {
              vfs.closeSync(fd)
            } catch {
              // already closed
            }
          }),
      ).pipe(Effect.map((fd) => makeFileHandle(vfs, path, fd))),
    readDirectory: (path, options) =>
      attempt('readDirectory', path, () =>
        options?.recursive ? walkRelative(vfs, path) : vfs.readdirSync(path),
      ),
    readFile: (path) => attempt('readFile', path, () => new Uint8Array(vfs.readFileSync(path))),
    readLink: (path) => attempt('readLink', path, () => vfs.readlinkSync(path)),
    realPath: (path) => attempt('realPath', path, () => vfs.realpathSync(path)),
    remove: (path, options) =>
      attempt('remove', path, () => {
        try {
          if (options?.recursive) {
            removeRecursive(vfs, path)
          } else if (vfs.lstatSync(path).isDirectory()) {
            vfs.rmdirSync(path)
          } else {
            vfs.unlinkSync(path)
          }
        } catch (cause) {
          if (options?.force && (cause as { code?: unknown } | null | undefined)?.code === 'ENOENT')
            return
          throw cause
        }
      }),
    rename: (oldPath, newPath) =>
      attempt('rename', oldPath, () => vfs.renameSync(oldPath, newPath)),
    stat: (path) => attempt('stat', path, () => toInfo(vfs.statSync(path))),
    symlink: (fromPath, toPath) =>
      attempt('symlink', fromPath, () => vfs.symlinkSync(fromPath, toPath)),
    truncate: (path, length) =>
      attempt('truncate', path, () => {
        const current = vfs.readFileSync(path)
        vfs.writeFileSync(path, current.subarray(0, Number(length ?? 0)))
      }),
    utimes: () => Effect.void,
    watch: (path) =>
      Stream.fail(
        toError('watch', path, {
          code: 'ENOSYS',
          message: 'watch is not supported by the in-memory filesystem',
        }),
      ),
    writeFile: (path, data) => attempt('writeFile', path, () => vfs.writeFileSync(path, data)),
  })

  return Layer.succeed(FileSystem.FileSystem, impl)
}

/**
 * Convenience alias for {@link layer}.
 *
 * @param diskLayout - Object mapping file paths to their contents
 * @returns Layer that provides a `FileSystem` service backed by memory
 */
export const layerFromDiskLayout = (diskLayout: DiskLayout) => layer(diskLayout)
