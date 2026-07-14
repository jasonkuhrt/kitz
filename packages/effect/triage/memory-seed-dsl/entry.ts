import * as Data from 'effect/Data'
import * as Schema from 'effect/Schema'
import type { LiteralGuard } from '../path/core/literal.js'
import * as Path from '../path/__.js'

/** Declarative entries accepted by `MemoryFileSystem.layer`. */
export type Entry = Data.TaggedEnum<{
  Directory: { readonly path: Path.Dir }
  File: { readonly path: Path.File; readonly bytes: Uint8Array }
}>

export type DirectoryEntry = Extract<Entry, { readonly _tag: 'Directory' }>
export type FileEntry = Extract<Entry, { readonly _tag: 'File' }>

const Entry = Data.taggedEnum<Entry>()

type DirectoryLiteralGuard<$Path extends string> = LiteralGuard<
  $Path,
  Path.Dir,
  'MemoryFileSystem.directory'
>

type FileLiteralGuard<$Path extends string> = LiteralGuard<
  $Path,
  Path.File,
  'MemoryFileSystem.file'
>

/** Seed an in-memory directory from a decoded path or checked literal. */
export const directory = <const $Path extends Path.Dir | string>(
  path: $Path extends string ? DirectoryLiteralGuard<$Path> : $Path,
): DirectoryEntry =>
  Entry.Directory({
    path: typeof path === 'string' ? Schema.decodeSync(Path.Dir)(path) : path,
  })

/** Seed an in-memory file from a decoded path or checked literal. */
export const file = <const $Path extends Path.File | string>(
  path: $Path extends string ? FileLiteralGuard<$Path> : $Path,
  content: string | Uint8Array = '',
): FileEntry =>
  Entry.File({
    path: typeof path === 'string' ? Schema.decodeSync(Path.File)(path) : path,
    bytes:
      typeof content === 'string'
        ? new TextEncoder().encode(content)
        : Uint8Array.from(content),
  })
