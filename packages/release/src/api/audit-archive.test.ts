import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { sha256Json } from './digest.js'
import { bundleForPlan, makeAuditArchive } from './audit-archive.js'
import { Plan } from './planner/models/plan.js'
import { PlanDigest } from './release-contract.js'

const digest = PlanDigest.make(sha256Json({ plan: 'audit' }))

describe('audit archive bundle', () => {
  test('builds a gzip tarball with manifest, checksums, signature, and payload files', () => {
    const bundle = makeAuditArchive({
      planDigest: digest,
      createdAt: '2026-05-14T00:00:00.000Z',
      payloads: [
        {
          path: Fs.Path.RelFile.fromString('./plan.json'),
          content: '{"schemaVersion":2}\n',
        },
        {
          path: Fs.Path.RelFile.fromString('./journal.jsonl'),
          content: '',
        },
      ],
    })
    const archiveBytes = new Uint8Array(new ArrayBuffer(bundle.bytes.byteLength))
    archiveBytes.set(bundle.bytes)
    const tarBytes = Bun.gunzipSync(archiveBytes)
    const tarText = new TextDecoder().decode(tarBytes)

    expect(bundle.manifest.files.map((file) => Fs.Path.toString(file.path))).toEqual([
      './plan.json',
      './journal.jsonl',
    ])
    expect(tarText).toContain('manifest.json')
    expect(tarText).toContain('sha256sums.txt')
    expect(tarText).toContain('manifest.json.sig')
    expect(tarText).toContain('plan.json')
  })

  test('bundleForPlan composes the fixed five audit payloads and archive path', async () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-05-14T00:00:00.000Z',
      releases: [],
      cascades: [],
    })
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    // Empty memory FS → no proof/manifest/journal files → proof:null,
    // artifacts:[], journal empty; the five payloads are still composed.
    const { bundle, archivePath } = await Effect.runPromise(
      bundleForPlan(plan, { createdAt: '2026-05-14T00:00:00.000Z' }).pipe(
        Effect.provide(Layer.mergeAll(Env.Test({ cwd }), Fs.Memory.layer({}))),
      ),
    )

    expect(bundle.manifest.files.map((file) => Fs.Path.toString(file.path))).toEqual([
      './plan.json',
      './proof.json',
      './journal.jsonl',
      './artifact-manifest.json',
      './registry-observations.json',
    ])
    expect(Fs.Path.toString(archivePath)).toContain('.kitz-release-audit.tgz')

    const archiveBytes = new Uint8Array(new ArrayBuffer(bundle.bytes.byteLength))
    archiveBytes.set(bundle.bytes)
    const tarText = new TextDecoder().decode(Bun.gunzipSync(archiveBytes))
    expect(tarText).toContain('registry-observations.json')
  })
})
