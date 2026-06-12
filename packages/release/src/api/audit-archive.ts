import { Codec } from '@kitz/codec'
import { Fs } from '@kitz/fs'
import { Array as A, DateTime, Schema } from 'effect'
import { AuditArchiveManifest } from './contract/audit.js'
import { DetachedSignature } from './contract/trust.js'
import { sha256Text, type Digest } from './digest.js'

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
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength))
  copy.set(bytes)
  return copy
}

const tar = (files: readonly AuditPayloadFile[]): Uint8Array =>
  Codec.Tar.create(
    A.map(files, (file) => ({
      path: Fs.Path.toString(file.path).replace(/^\.\//u, ''),
      content: encoder.encode(file.content),
    })),
    { uname: 'kitz', gname: 'kitz' },
  )

export const makeAuditManifest = (params: {
  readonly planDigest: Digest
  readonly createdAt: DateTime.Utc
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
  readonly planDigest: Digest
  readonly createdAt: DateTime.Utc
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
