/**
 * Typed surface for `@platformatic/vfs`.
 *
 * The package's `package.json` declares `types: index.d.ts` but ships no such
 * file, so the import resolves to `any`. We re-type the `node:fs`-shaped methods
 * the memory layer uses here (no `@types/node` dependency needed) and cast the
 * untyped `create` to that surface. `@platformatic/vfs` is the userland extraction
 * of Node core's upcoming `node:vfs`; when that ships, swap this import for
 * `node:vfs` with the same shape.
 */
import { create as createUntyped } from '@platformatic/vfs'

/** Subset of `node:fs` `Stats` returned by the vfs stat methods. */
export interface VfsStats {
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
  isBlockDevice(): boolean
  isCharacterDevice(): boolean
  isFIFO(): boolean
  isSocket(): boolean
  readonly dev: number
  readonly ino: number
  readonly mode: number
  readonly nlink: number
  readonly uid: number
  readonly gid: number
  readonly rdev: number
  readonly size: number
  readonly blksize: number
  readonly blocks: number
  readonly atime: Date
  readonly mtime: Date
  readonly ctime: Date
  readonly birthtime: Date
}

/** A standalone in-memory filesystem object — used directly, never mounted. */
export interface VirtualFileSystem {
  statSync(path: string): VfsStats
  lstatSync(path: string): VfsStats
  fstatSync(fd: number): VfsStats
  readFileSync(path: string): Uint8Array
  writeFileSync(path: string, data: string | Uint8Array): void
  readdirSync(path: string): Array<string>
  mkdirSync(
    path: string,
    options?: { recursive?: boolean | undefined; mode?: number | undefined },
  ): string | undefined
  rmdirSync(path: string): void
  unlinkSync(path: string): void
  renameSync(oldPath: string, newPath: string): void
  copyFileSync(src: string, dest: string): void
  realpathSync(path: string): string
  readlinkSync(path: string): string
  symlinkSync(target: string, path: string): void
  accessSync(path: string, mode?: number): void
  existsSync(path: string): boolean
  openSync(path: string, flags: string): number
  closeSync(fd: number): void
  readSync(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number
}

/** Create a `VirtualFileSystem` backed by an in-memory `MemoryProvider`. */
export const create: () => VirtualFileSystem = createUntyped
