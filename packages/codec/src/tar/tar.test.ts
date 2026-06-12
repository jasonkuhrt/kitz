import { describe, expect, test } from 'bun:test'
import { create, type FileEntry } from './tar.js'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const file = (path: string, content: string): FileEntry => ({
  path,
  content: encoder.encode(content),
})

/** Read a NUL-terminated ASCII field from a header. */
const field = (header: Uint8Array, offset: number, length: number): string => {
  const bytes = header.subarray(offset, offset + length)
  const end = bytes.indexOf(0)
  return decoder.decode(end === -1 ? bytes : bytes.subarray(0, end))
}

/** Parse all entries of an uncompressed tar archive. */
const readArchive = (
  bytes: Uint8Array,
): { path: string; content: Uint8Array; header: Uint8Array }[] => {
  const entries: { path: string; content: Uint8Array; header: Uint8Array }[] = []
  let offset = 0
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const size = Number.parseInt(field(header, 124, 12), 8)
    const content = bytes.subarray(offset + 512, offset + 512 + size)
    entries.push({ path: field(header, 0, 100), content, header })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

describe('Tar.create', () => {
  test('roundtrips entry paths and contents', () => {
    const bytes = create([
      file('manifest.json', '{"schemaVersion":1}\n'),
      file('notes/readme.txt', 'hello tar'),
      file('empty.txt', ''),
    ])
    const entries = readArchive(bytes)

    expect(entries.map((entry) => entry.path)).toEqual([
      'manifest.json',
      'notes/readme.txt',
      'empty.txt',
    ])
    expect(decoder.decode(entries[0]!.content)).toBe('{"schemaVersion":1}\n')
    expect(decoder.decode(entries[1]!.content)).toBe('hello tar')
    expect(entries[2]!.content.length).toBe(0)
  })

  test('every entry is aligned to 512-byte blocks and the archive ends with two zero blocks', () => {
    const content = 'x'.repeat(513) // forces 2 content blocks
    const bytes = create([file('a.txt', content)])

    // header (512) + content padded to 1024 + end-of-archive (1024)
    expect(bytes.length).toBe(512 + 1024 + 1024)
    expect(bytes.length % 512).toBe(0)
    // padding after content is zero-filled
    expect(bytes.subarray(512 + 513, 512 + 1024).every((byte) => byte === 0)).toBe(true)
    // trailing end-of-archive blocks are zero-filled
    expect(bytes.subarray(bytes.length - 1024).every((byte) => byte === 0)).toBe(true)
  })

  test('header checksum is the byte sum with the checksum field as spaces', () => {
    const bytes = create([file('checked.txt', 'payload')])
    const [entry] = readArchive(bytes)
    const header = entry!.header

    const stored = Number.parseInt(field(header, 148, 8).trim(), 8)
    const recomputed = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 0x20 : byte),
      0,
    )
    expect(stored).toBe(recomputed)
  })

  test('numeric fields use NUL-terminated zero-padded octal', () => {
    const bytes = create([file('octal.txt', 'abc')], { mode: 0o755, mtimeSeconds: 1_000_000_000 })
    const [entry] = readArchive(bytes)
    const header = entry!.header

    expect(field(header, 100, 8)).toBe('0000755')
    expect(field(header, 124, 12)).toBe('00000000003')
    expect(field(header, 136, 12)).toBe('07346545000')
    expect(Number.parseInt(field(header, 136, 12), 8)).toBe(1_000_000_000)
  })

  test('writes ustar magic, version, and owner names', () => {
    const bytes = create([file('meta.txt', 'm')], { uname: 'kitz', gname: 'kitz' })
    const [entry] = readArchive(bytes)
    const header = entry!.header

    expect(field(header, 257, 6)).toBe('ustar')
    expect(decoder.decode(header.subarray(263, 265))).toBe('00')
    expect(field(header, 265, 32)).toBe('kitz')
    expect(field(header, 297, 32)).toBe('kitz')
    expect(field(header, 156, 1)).toBe('0')
  })

  test('byte-golden: a fixed input produces stable bytes', () => {
    const bytes = create([file('golden.txt', 'golden')])
    const again = create([file('golden.txt', 'golden')])

    expect(Buffer.from(bytes).toString('base64')).toBe(Buffer.from(again).toString('base64'))
    // defaults keep archives reproducible: mtime 0, uid/gid 0
    const [entry] = readArchive(bytes)
    expect(Number.parseInt(field(entry!.header, 136, 12), 8)).toBe(0)
    expect(Number.parseInt(field(entry!.header, 108, 8), 8)).toBe(0)
    expect(Number.parseInt(field(entry!.header, 116, 8), 8)).toBe(0)
  })
})
