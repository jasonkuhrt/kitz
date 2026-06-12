/**
 * Minimal POSIX ustar archive writer.
 *
 * Produces uncompressed tar bytes for a list of in-memory files. Every entry
 * is written as a regular file (`typeflag '0'`) with a 512-byte ustar header
 * followed by the content padded to the next 512-byte block boundary. The
 * archive ends with the mandatory two zero-filled 512-byte blocks.
 *
 * @see {@link https://pubs.opengroup.org/onlinepubs/9699919799/utilities/pax.html#tag_20_92_13_06 | POSIX ustar Interchange Format}
 */

const encoder = new TextEncoder()

const BLOCK_SIZE = 512
const END_OF_ARCHIVE_SIZE = BLOCK_SIZE * 2

/** A single file to be written into the archive. */
export interface FileEntry {
  /** Entry path as recorded in the header (max 100 bytes in ustar). */
  readonly path: string
  /** File content bytes. */
  readonly content: Uint8Array
}

/** Archive-wide header options applied to every entry. */
export interface CreateOptions {
  /** File mode bits (default `0o644`). */
  readonly mode?: number
  /** Owner user name header field (default empty). */
  readonly uname?: string
  /** Owner group name header field (default empty). */
  readonly gname?: string
  /** Modification time as epoch seconds (default `0` for reproducible bytes). */
  readonly mtimeSeconds?: number
}

/**
 * Render a number as a NUL-terminated zero-padded octal field of the given
 * total byte length (the ustar numeric field encoding).
 */
const octal = (value: number, length: number): string =>
  value
    .toString(8)
    .padStart(length - 1, '0')
    .slice(0, length - 1) + '\0'

const writeAscii = (buffer: Uint8Array, offset: number, length: number, value: string): void => {
  const bytes = encoder.encode(value)
  buffer.set(bytes.slice(0, length), offset)
}

/** Round a byte length up to the next 512-byte block boundary. */
const padToBlock = (length: number): number => Math.ceil(length / BLOCK_SIZE) * BLOCK_SIZE

const entryBytes = (entry: FileEntry, options: CreateOptions): Uint8Array => {
  const size = entry.content.length
  const output = new Uint8Array(BLOCK_SIZE + padToBlock(size))
  const header = output.subarray(0, BLOCK_SIZE)

  writeAscii(header, 0, 100, entry.path) // name
  writeAscii(header, 100, 8, octal(options.mode ?? 0o644, 8)) // mode
  writeAscii(header, 108, 8, octal(0, 8)) // uid
  writeAscii(header, 116, 8, octal(0, 8)) // gid
  writeAscii(header, 124, 12, octal(size, 12)) // size
  writeAscii(header, 136, 12, octal(options.mtimeSeconds ?? 0, 12)) // mtime
  // The checksum field is computed over the header with the checksum bytes
  // treated as ASCII spaces.
  header.fill(0x20, 148, 156)
  writeAscii(header, 156, 1, '0') // typeflag: regular file
  writeAscii(header, 257, 6, 'ustar') // magic (NUL-terminated by buffer zero-fill)
  writeAscii(header, 263, 2, '00') // version
  writeAscii(header, 265, 32, options.uname ?? '') // uname
  writeAscii(header, 297, 32, options.gname ?? '') // gname

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  // Checksum encoding: six octal digits, NUL, space.
  writeAscii(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ')

  output.set(entry.content, BLOCK_SIZE)
  return output
}

/**
 * Create an uncompressed ustar archive from in-memory files.
 *
 * @example
 * ```ts
 * import { Tar } from '@kitz/codec'
 *
 * const bytes = Tar.create([
 *   { path: 'manifest.json', content: new TextEncoder().encode('{}') },
 * ])
 * ```
 */
export const create = (files: readonly FileEntry[], options: CreateOptions = {}): Uint8Array => {
  const entries = files.map((file) => entryBytes(file, options))
  const size = entries.reduce((sum, entry) => sum + entry.length, END_OF_ARCHIVE_SIZE)
  const output = new Uint8Array(size)
  let offset = 0

  for (const entry of entries) {
    output.set(entry, offset)
    offset += entry.length
  }

  return output
}
