import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Array as A, Effect, FileSystem, Option, Schema } from 'effect'
import * as Artifact from './artifact.js'
import { Digest, sha256Text } from './digest.js'
import * as Journal from './journal.js'
import { Plan } from './planner/models/plan.js'
import * as Proof from './proof.js'
import {
  ArtifactManifest,
  AuditArchiveManifest,
  DetachedSignature,
  digestForPlan,
  type PlanDigest,
  ProofArtifact,
  SideEffectEntry,
} from './release-contract.js'

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

/**
 * Compose the full release audit archive for a plan: read the plan-bound proof,
 * artifact manifest, and side-effect journal, then bundle them with the plan
 * into the fixed five-payload archive (plan, proof, journal, artifact manifest,
 * registry observations). Returns the gzipped bundle plus the conventional
 * archive path so the caller only has to write the bytes.
 */
export const bundleForPlan = (plan: Plan, options: { readonly createdAt: string }) =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const proof = yield* Proof.readForPlan(plan)
    const artifacts = yield* Artifact.readManifest(plan)
    const digest = digestForPlan(plan)
    const journalEntries = yield* Journal.readEntries(Journal.journalPathFor(env.cwd, digest))
    const archivePath = Fs.Path.join(
      env.cwd,
      Fs.Path.RelFile.fromString(`./.release/archive/${digest.value}.kitz-release-audit.tgz`),
    )
    const bundle = makeAuditArchive({
      planDigest: digest,
      createdAt: options.createdAt,
      payloads: [
        {
          path: Fs.Path.RelFile.fromString('./plan.json'),
          content: `${JSON.stringify(Schema.encodeSync(Plan)(plan), null, 2)}\n`,
        },
        {
          path: Fs.Path.RelFile.fromString('./proof.json'),
          content: `${JSON.stringify(
            Option.isSome(proof) ? Schema.encodeSync(ProofArtifact)(proof.value) : null,
            null,
            2,
          )}\n`,
        },
        {
          path: Fs.Path.RelFile.fromString('./journal.jsonl'),
          content:
            journalEntries
              .map((entry) => JSON.stringify(Schema.encodeSync(SideEffectEntry)(entry)))
              .join('\n') + '\n',
        },
        {
          path: Fs.Path.RelFile.fromString('./artifact-manifest.json'),
          content: `${JSON.stringify(
            Option.isSome(artifacts)
              ? Schema.encodeSync(Schema.Array(ArtifactManifest))([...artifacts.value])
              : [],
            null,
            2,
          )}\n`,
        },
        {
          path: Fs.Path.RelFile.fromString('./registry-observations.json'),
          content: '[]\n',
        },
      ],
    })

    return { bundle, archivePath }
  })
