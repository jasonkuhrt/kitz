import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { sha256Bytes, sha256Json } from '../digest.js'
import {
  ArtifactManifest,
  PlanDigest,
  PublishReceipt,
  RegistryObservation,
} from '../release-contract.js'
import { verifyRegistryObservation } from './verification.js'

const digest = PlanDigest.make(sha256Json({ plan: 'registry' }))
const bytes = new Uint8Array([1, 2, 3])
const artifact = ArtifactManifest.make({
  schemaVersion: 1,
  planDigest: digest,
  packageName: Pkg.Moniker.parse('@kitz/core'),
  version: Semver.fromString('1.2.3'),
  driver: 'npm',
  tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/core.tgz'),
  sha256: sha256Bytes(bytes),
  sizeBytes: bytes.length,
  manifest: { name: '@kitz/core', version: '1.2.3' },
  packlist: [Fs.Path.RelFile.fromString('./package.json')],
  rewrittenFields: ['version'],
  npmRegistryIntegrity: 'sha512-local',
  npmRegistryShasum: 'sha1-local',
})

const observation = RegistryObservation.make({
  packageName: Pkg.Moniker.parse('@kitz/core'),
  version: Semver.fromString('1.2.3'),
  registry: 'https://registry.npmjs.org/',
  observedAt: '2026-05-14T00:00:00.000Z',
  versionMetadata: { name: '@kitz/core', version: '1.2.3' },
  distTags: { latest: '1.2.3' },
  accessStatus: 'public',
  tarballUrl: 'https://registry.npmjs.org/@kitz/core/-/core-1.2.3.tgz',
  shasum: 'sha1-local',
  integrity: 'sha512-local',
  downloadedTarballSha256: artifact.sha256,
})

const receipt = PublishReceipt.make({
  schemaVersion: 1,
  planDigest: digest,
  tarballSha256: artifact.sha256,
  observation,
  verifiedAt: '2026-05-14T00:00:01.000Z',
})

describe('post-publish registry verification', () => {
  test('accepts matching version, dist-tag, metadata, access, and official tarball bytes', () => {
    const result = verifyRegistryObservation({
      artifact,
      observation,
      distTag: 'latest',
      official: true,
      requestedAccess: 'public',
      receipt,
    })

    expect(result.issues).toEqual([])
  })

  test('reports every registry mismatch that would make publish incomplete', () => {
    const mismatched = RegistryObservation.make({
      ...observation,
      packageName: Pkg.Moniker.parse('@kitz/other'),
      version: Semver.fromString('9.9.9'),
      distTags: { latest: '1.2.2' },
      accessStatus: 'restricted',
      shasum: 'other-sha1',
      integrity: 'other-integrity',
      downloadedTarballSha256: sha256Json({ different: true }),
    })
    const result = verifyRegistryObservation({
      artifact,
      observation: mismatched,
      distTag: 'latest',
      official: true,
      requestedAccess: 'public',
      receipt: PublishReceipt.make({
        ...receipt,
        tarballSha256: sha256Json({ differentReceipt: true }),
      }),
    })

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'release.registry.version-mismatch',
      'release.registry.dist-tag-mismatch',
      'release.registry.access-mismatch',
      'release.registry.shasum-mismatch',
      'release.registry.integrity-mismatch',
      'release.registry.tarball-sha256-mismatch',
      'release.receipt.tarball-sha256-mismatch',
    ])
  })

  test('does not require downloaded tarball byte equality for non-official releases', () => {
    const result = verifyRegistryObservation({
      artifact,
      observation: RegistryObservation.make({
        ...observation,
        downloadedTarballSha256: sha256Json({ candidate: true }),
      }),
      distTag: 'latest',
      official: false,
      receipt,
    })

    expect(result.issues).toEqual([])
  })
})
