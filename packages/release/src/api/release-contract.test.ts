import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import * as fc from 'fast-check'
import {
  arbAbsFile,
  arbJsonRecord,
  arbMoniker,
  arbRelFile,
  arbSemver,
  roundtrips,
} from '../test-support.js'
import { Digest, sha256Json } from './digest.js'
import {
  ArtifactManifest,
  defaultArtifactPolicy,
  defaultGithubHostProfile,
  defaultProofPolicy,
  defaultRegistryProfile,
  makeUnsignedEnvelope,
  PlanBody,
  PlanDigest,
  PlanSourceSnapshot,
  ProofArtifact,
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
  })

  test('publish intent can use the project package-manager driver', () => {
    const semantics = resolvePublishSemantics({ lifecycle: 'official' })
    const intent = publishIntentFromSemantics({
      semantics,
      trunk: 'main',
      packageManager: 'pnpm',
    })

    expect(intent.profile.id).toBe('pnpm-tarball')
    expect(intent.profile.packDriver).toBe('pnpm')
    expect(intent.profile.publishInvoker).toBe('pnpm')
  })

  test('trusted publisher intent records registry, host, proof, and provenance defaults', () => {
    const semantics = resolvePublishSemantics({
      lifecycle: 'official',
      publishing: {
        official: { mode: 'github-trusted', workflow: 'publish.yml' },
        candidate: { mode: 'manual' },
        ephemeral: { mode: 'manual' },
      },
    })
    const intent = publishIntentFromSemantics({
      semantics,
      trunk: 'main',
      registry: 'https://registry.example.test/',
    })

    expect(intent.registry.url).toBe('https://registry.example.test/')
    expect(intent.profile.trustedPublisherAdmin).toBe('npm-trust')
    expect(intent.auth.source).toBe('trusted-oidc')
    expect(intent.auth.runtimeHost).toBe('github-actions')
    expect(intent.auth.tokenEnv).toBeUndefined()
    expect(intent.provenance.mode).toBe('trusted-publisher')
    expect(intent.provenance.provider).toBe('npm-github')
    expect(defaultProofPolicy('github-actions').authProofTtlSeconds).toBe(3_600)
    expect(defaultRegistryProfile().strictSsl).toBe(true)
    expect(defaultGithubHostProfile().oidcIssuer).toBe(
      'https://token.actions.githubusercontent.com',
    )
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
      releases: [
        {
          packageName: Pkg.Moniker.parse('@kitz/core'),
          nextVersion: Semver.fromString('1.2.3'),
        },
      ],
    })
    const envelope = makeUnsignedEnvelope(body)
    const encoded = Schema.encodeSync(PlanBody)(body)

    expect(envelope.digest.value).toBe(sha256Json(encoded).value)
    expect(envelope.signature.signature).toBe('unsigned')
  })

  test('artifact manifests encode exact tarball metadata shape', () => {
    const manifest = ArtifactManifest.make({
      schemaVersion: 1,
      planDigest: PlanDigest.make(sha256Json({ plan: 'core' })),
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

// ── Properties ───────────────────────────────────────────────────────

roundtrips('ProofArtifact', ProofArtifact)

// `Schema.toArbitrary(ArtifactManifest)` is unusable directly: the upstream
// leaf class schemas (`Pkg.Moniker`, `Semver`, `Fs.Path.*`) derive type-side
// arbitraries that violate their encoded contracts (scopes containing `/`,
// path segments containing `/`, numeric-string prerelease identifiers). Those
// leaves are generated through their production parsers instead; everything
// else still comes from `Schema.toArbitrary`.
const arbDigest = Schema.toArbitrary(Digest)

const arbArtifactManifest = fc
  .record({
    schemaVersion: fc.constant(1 as const),
    planDigest: arbDigest,
    packageName: arbMoniker,
    version: arbSemver,
    driver: fc.string(),
    tarball: arbAbsFile,
    sha256: arbDigest,
    sizeBytes: fc.nat(),
    manifest: arbJsonRecord,
    packlist: fc.array(arbRelFile, { maxLength: 4 }),
    rewrittenFields: fc.array(fc.string(), { maxLength: 3 }),
  })
  .map((fields) => ArtifactManifest.make(fields))

roundtrips('ArtifactManifest', ArtifactManifest, arbArtifactManifest)
