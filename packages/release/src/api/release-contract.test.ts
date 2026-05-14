import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { sha256Json } from './digest.js'
import {
  ArtifactManifest,
  defaultArtifactPolicy,
  defaultProofPolicy,
  makeUnsignedEnvelope,
  PlanBody,
  PlanSourceSnapshot,
  publishIntentFromSemantics,
} from './release-contract.js'
import { resolvePublishSemantics } from './publishing.js'

describe('release contract models', () => {
  test('publish intent is derived from frozen publish semantics', () => {
    const semantics = resolvePublishSemantics({ lifecycle: 'official' })
    const intent = publishIntentFromSemantics({ semantics, trunk: 'main' })

    expect(intent.profile.publishInvoker).toBe('npm')
    expect(intent.registry.url).toBe('https://registry.npmjs.org/')
    expect(intent.distTag).toBe('latest')
    expect(intent.artifacts.scriptPolicy.default).toBe('deny')
  })

  test('plan envelope digest is detached from the envelope wrapper', () => {
    const semantics = resolvePublishSemantics({ lifecycle: 'candidate' })
    const source = PlanSourceSnapshot.make({
      headSha: 'abc1234',
      trunk: 'main',
      releaseConfigDigest: sha256Json({ config: true }),
      releaseConfigDigestSource: 'canonical-effective-config',
      lockfiles: [],
      packageManager: {
        name: 'bun',
        version: '1.3.6',
        binary: 'bun',
        subcommands: { pack: true, publish: true },
      },
      toolVersions: { bun: '1.3.6' },
    })
    const body = PlanBody.make({
      schemaVersion: 2,
      signingProfileId: 'local-developer',
      source,
      publishIntent: publishIntentFromSemantics({ semantics, trunk: 'main' }),
      proofPolicy: defaultProofPolicy(),
    })
    const envelope = makeUnsignedEnvelope(body)
    const encoded = Schema.encodeSync(PlanBody)(body)

    expect(envelope.digest.value).toBe(sha256Json(encoded).value)
    expect(envelope.signature.signature).toBe('unsigned')
  })

  test('artifact manifests encode exact tarball metadata shape', () => {
    const manifest = ArtifactManifest.make({
      schemaVersion: 1,
      packageName: Pkg.Moniker.parse('@kitz/core'),
      version: Semver.fromString('1.2.3'),
      driver: 'npm',
      tarball: Fs.Path.AbsFile.fromString('/repo/.release/artifacts/core.tgz'),
      sha256: sha256Json({ tarball: 'core' }),
      sizeBytes: 10,
      manifest: { name: '@kitz/core', version: '1.2.3' },
      packlist: [Fs.Path.RelFile.fromString('./package/package.json')],
      rewrittenFields: ['version'],
    })

    const roundTrip = Schema.decodeSync(ArtifactManifest)(
      Schema.encodeSync(ArtifactManifest)(manifest),
    )
    expect(roundTrip.packageName.moniker).toBe('@kitz/core')
    expect(defaultArtifactPolicy().forbiddenFilePatterns).toContain('.npmrc')
  })
})
