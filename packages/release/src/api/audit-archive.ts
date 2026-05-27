import { Fs } from '@kitz/fs'
import { Array as A, Schema } from 'effect'
import { Digest, sha256Text } from './digest.js'
import { AuditArchiveManifest, DetachedSignature, type PlanDigest } from './release-contract.js'

export interface AuditPayloadFile {
  readonly path: Fs.Path.RelFile
  readonly content: string
}

export interface AuditArchiveBundle {
  readonly manifest: AuditArchiveManifest
  readonly bytes: Uint8Array
}

const encoder = new TextEncoder()

const asArrayBufferBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array<ArrayBuffer>(new ArrayBuffer(bytes.byteLength))
  copy.set(bytes)
  return copy
}

const octal = (value: number, length: number): string =>
  value
    .toString(8)
    .padStart(length - 1, '0')
    .slice(0, length - 1) + '\0'

const writeAscii = (buffer: Uint8Array, offset: number, length: number, value: string): void => {
  const bytes = encoder.encode(value)
  buffer.set(bytes.slice(0, length), offset)
}

const padBlock = (length: number): number => Math.ceil(length / 512) * 512

const tarEntry = (path: string, content: Uint8Array): Uint8Array => {
  const size = content.length
  const output = new Uint8Array(512 + padBlock(size))
  const header = output.subarray(0, 512)

  writeAscii(header, 0, 100, path.replace(/^\.\//u, ''))
  writeAscii(header, 100, 8, octal(0o644, 8))
  writeAscii(header, 108, 8, octal(0, 8))
  writeAscii(header, 116, 8, octal(0, 8))
  writeAscii(header, 124, 12, octal(size, 12))
  writeAscii(header, 136, 12, octal(0, 12))
  header.fill(0x20, 148, 156)
  writeAscii(header, 156, 1, '0')
  writeAscii(header, 257, 6, 'ustar')
  writeAscii(header, 263, 2, '00')
  writeAscii(header, 265, 32, 'kitz')
  writeAscii(header, 297, 32, 'kitz')

  const checksum = A.reduce(header, 0, (sum, byte) => sum + byte)
  writeAscii(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ')
  output.set(content, 512)
  return output
}

const tar = (files: readonly AuditPayloadFile[]): Uint8Array => {
  const entries = A.map(files, (file) =>
    tarEntry(Fs.Path.toString(file.path), encoder.encode(file.content)),
  )
  const size = A.reduce(entries, 1024, (sum, entry) => sum + entry.length)
  const output = new Uint8Array(size)
  let offset = 0

  for (const entry of entries) {
    output.set(entry, offset)
    offset += entry.length
  }

  return output
}

export const makeAuditManifest = (params: {
  readonly planDigest: PlanDigest
  readonly createdAt: string
  readonly payloads: readonly AuditPayloadFile[]
}): AuditArchiveManifest =>
  AuditArchiveManifest.make({
    schemaVersion: 1,
    planDigest: params.planDigest,
    createdAt: params.createdAt,
    files: A.map(params.payloads, (payload) => ({
      path: payload.path,
      sha256: sha256Text(payload.content),
    })),
    signature: DetachedSignature.make({
      algorithm: 'ssh-signature',
      signer: 'unsigned-local-audit-archive',
      signature: 'unsigned',
    }),
  })

export const makeAuditArchive = (params: {
  readonly planDigest: PlanDigest
  readonly createdAt: string
  readonly payloads: readonly AuditPayloadFile[]
}): AuditArchiveBundle => {
  const manifest = makeAuditManifest(params)
  const manifestJson = `${JSON.stringify(Schema.encodeSync(AuditArchiveManifest)(manifest), null, 2)}\n`
  const checksums = A.map(
    params.payloads,
    (payload) => `${sha256Text(payload.content).value}  ${Fs.Path.toString(payload.path)}`,
  ).join('\n')
  const signature = `${JSON.stringify(Schema.encodeSync(DetachedSignature)(manifest.signature), null, 2)}\n`
  const payloads = [
    { path: Fs.Path.RelFile.fromString('./manifest.json'), content: manifestJson },
    { path: Fs.Path.RelFile.fromString('./sha256sums.txt'), content: `${checksums}\n` },
    { path: Fs.Path.RelFile.fromString('./manifest.json.sig'), content: signature },
    ...params.payloads,
  ]

  return {
    manifest,
    bytes: Bun.gzipSync(asArrayBufferBytes(tar(payloads))),
  }
}
