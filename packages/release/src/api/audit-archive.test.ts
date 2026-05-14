import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'bun:test'
import { sha256Json } from './digest.js'
import { makeAuditArchive } from './audit-archive.js'
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
})
