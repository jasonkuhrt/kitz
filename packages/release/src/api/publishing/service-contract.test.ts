import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import { Effect, HashSet, Layer, Option, Schema } from 'effect'
import * as Artifact from '../artifact.js'
import { sha256Json } from '../digest.js'
import * as Executor from '../executor/execute.js'
import * as Proof from '../proof.js'
import { ArtifactManifest, PlanDigest } from '../release-contract.js'
import { Artifacter } from './artifacter.js'
import { Credentials } from './credentials.js'
import {
  PublishingCapabilityError,
  PublishingOperation,
  publishingServiceOperationValues,
} from './errors.js'
import type { PublishCapability } from './models/capability.js'
import { ReleaseIoDomain, releaseIoDomainValues } from './models/domain.js'
import {
  DriverVersionProof,
  PackedArtifact,
  PublishDryRunProof,
  PublishReceipt,
  SubcommandProof,
} from './models/proof.js'
import {
  agentFromProjectManager,
  PackageManager,
  PackageManagerCommand,
} from './package-manager.js'
import { PackageRegistry } from './package-registry.js'
import { ReleaseManager } from './release-manager.js'
import {
  AccessQuery,
  ArtifactBuildRequest,
  BatchAccessQuery,
  BatchDistTagQuery,
  BatchVersionQuery,
  DistTagQuery,
  OtpRequest,
  PackRequest,
  PublishRequest,
  SubcommandProofRequest,
  TrustedPublisherQuery,
  TrustedPublisherSetup,
  VersionQuery,
  WhoamiRequest,
} from './requests.js'
import {
  AccessProof,
  AuthIdentityProof,
  DistTagProof,
  OtpSecret,
  RegistryTarballObservation,
  TrustedPublisherProof,
  VersionProof,
} from './results.js'

const observedAt = '2026-05-27T00:00:00.000Z'
const packageName = Pkg.Moniker.parse('@kitz/core')
const version = Semver.fromString('1.2.3')
const packageDir = Fs.Path.AbsDir.fromString('/repo/packages/core/')
const destination = Fs.Path.AbsDir.fromString('/repo/.release/artifacts/')
const tarball = Fs.Path.AbsFile.fromString('/repo/.release/artifacts/kitz-core-1.2.3.tgz')
const sha256 = sha256Json({ tarball: '@kitz/core@1.2.3' })
const planDigest = PlanDigest.make(sha256Json({ plan: '@kitz/core@1.2.3' }))
const packlist = [Fs.Path.RelFile.fromString('./package.json')]
const publishCapabilities = [
  'publish:tarball',
  'publish:dry-run',
  'publish:tag',
  'publish:access',
] satisfies ReadonlyArray<PublishCapability>
const packCapabilities = [
  'pack:tarball',
  'pack:manifest-json',
  'pack:packlist',
] satisfies ReadonlyArray<PublishCapability>

const packRequest = PackRequest.make({
  packageDir,
  packageName,
  version,
  destination,
})

const publishRequest = PublishRequest.make({
  tarball,
  packageName,
  version,
  distTag: 'latest',
  registry: 'https://registry.npmjs.org/',
  access: 'public',
  otp: '123456',
  provenance: true,
  capabilities: [...publishCapabilities],
})

const artifactManifest = ArtifactManifest.make({
  schemaVersion: 1,
  planDigest,
  packageName,
  version,
  driver: 'npm',
  tarball,
  sha256,
  sizeBytes: 128,
  manifest: { name: '@kitz/core', version: '1.2.3' },
  packlist,
  rewrittenFields: ['version'],
})

const versionProof = VersionProof.make({
  packageName,
  version,
  exists: true,
  observedAt,
})

const distTagProof = DistTagProof.make({
  packageName,
  distTags: { latest: '1.2.3' },
  observedAt,
})

const accessProof = AccessProof.make({
  packageName,
  access: Option.some('public'),
  observedAt,
})

const trustedPublisherProof = TrustedPublisherProof.make({
  packageName,
  provider: 'github',
  repository: 'jasonkuhrt/kitz',
  workflow: 'release.yml',
  observedAt,
})

const registryTarballObservation = RegistryTarballObservation.make({
  packageName,
  version,
  integrity: 'sha512-fixture',
  shasum: 'sha1-fixture',
  sha256,
  observedAt,
})

const PackageManagerLayer = Layer.succeed(PackageManager, {
  id: 'npm',
  capabilities: HashSet.fromIterable([...packCapabilities, ...publishCapabilities]),
  version: Effect.succeed(
    DriverVersionProof.make({
      driver: 'npm',
      binary: 'npm',
      version: '11.6.4',
      observedAt,
    }),
  ),
  proveSubcommands: (_request) =>
    Effect.succeed(
      SubcommandProof.make({
        driver: 'npm',
        binary: 'npm',
        subcommands: { pack: true, publish: true, view: true },
        observedAt,
      }),
    ),
  pack: (request) =>
    Effect.succeed(
      PackedArtifact.make({
        packageName: request.packageName,
        version: request.version,
        tarball,
        sha256,
        sizeBytes: 128,
        packlist,
      }),
    ),
  publishDryRun: (request) =>
    Effect.succeed(
      PublishDryRunProof.make({
        driver: 'npm',
        command: PackageManagerCommand.fromParts('npm', [
          'publish',
          request.tarball.toString(),
          '--dry-run',
        ]),
        capabilities: [...request.capabilities],
        observedAt,
      }),
    ),
  publish: (request) =>
    Effect.succeed(
      PublishReceipt.make({
        driver: 'npm',
        packageName: request.packageName,
        version: request.version,
        distTag: request.distTag,
        registry: request.registry ?? 'https://registry.npmjs.org/',
        command: PackageManagerCommand.fromParts('npm', ['publish', request.tarball.toString()]),
        observedAt,
      }),
    ),
})

const PackageRegistryLayer = Layer.succeed(PackageRegistry, {
  viewPackageVersion: (_request) => Effect.succeed(Option.some(versionProof)),
  viewPackageVersions: (_request) => Effect.succeed([versionProof]),
  viewDistTags: (_request) => Effect.succeed(distTagProof),
  viewManyDistTags: (_request) => Effect.succeed([distTagProof]),
  access: (_request) => Effect.succeed(accessProof),
  accessMany: (_request) => Effect.succeed([accessProof]),
  tarballMetadata: (_request) => Effect.succeed(registryTarballObservation),
})

const CredentialsLayer = Layer.succeed(Credentials, {
  whoami: (_request) =>
    Effect.succeed(
      AuthIdentityProof.make({
        provider: 'npm',
        username: 'kitz-publisher',
        observedAt,
      }),
    ),
  resolveOtp: (_request) => Effect.succeed(Option.some(OtpSecret.make({ value: '123456' }))),
  trustedPublishers: (_request) => Effect.succeed(trustedPublisherProof),
  setupTrustedPublisher: (request) =>
    Effect.succeed(
      TrustedPublisherProof.make({
        packageName: request.packageName,
        provider: request.provider,
        repository: request.repository,
        workflow: request.workflow,
        observedAt,
      }),
    ),
})

const ArtifacterLayer = Layer.succeed(Artifacter, {
  build: (_request) => Effect.succeed(artifactManifest),
})

const ReleaseManagerLayer = Layer.succeed(ReleaseManager, {
  prove: Proof.prove,
  readProofForPlan: Proof.readForPlan,
  rehearse: Artifact.rehearse,
  execute: Executor.execute,
  resume: Executor.resume,
  status: Executor.status,
})

const PublishingLayer = Layer.mergeAll(
  PackageManagerLayer,
  PackageRegistryLayer,
  CredentialsLayer,
  ArtifacterLayer,
  ReleaseManagerLayer,
)

describe('publishing IO service contracts', () => {
  test('project package-manager detection maps onto publishing drivers', () => {
    expect(agentFromProjectManager('npm')).toBe('npm')
    expect(agentFromProjectManager('pnpm')).toBe('pnpm')
    expect(agentFromProjectManager('bun')).toBe('bun')
    expect(agentFromProjectManager('yarn')).toBe('npm')
    expect(agentFromProjectManager('unknown')).toBe('npm')
  })

  test('request and result schemas own every publishing IO payload shape', () => {
    const subcommandProofRequest = SubcommandProofRequest.decodeSync(
      SubcommandProofRequest.encodeSync(
        SubcommandProofRequest.make({
          binary: 'npm',
          subcommands: ['pack', 'publish', 'view'],
        }),
      ),
    )
    const packRequestRoundTrip = PackRequest.decodeSync(PackRequest.encodeSync(packRequest))
    const publishRequestRoundTrip = PublishRequest.decodeSync(
      PublishRequest.encodeSync(publishRequest),
    )
    const versionQuery = VersionQuery.decodeSync(
      VersionQuery.encodeSync(
        VersionQuery.make({
          packageName,
          version,
          registry: 'https://registry.npmjs.org/',
        }),
      ),
    )
    const batchVersionQuery = BatchVersionQuery.decodeSync(
      BatchVersionQuery.encodeSync(BatchVersionQuery.make({ versions: [versionQuery] })),
    )
    const distTagQuery = DistTagQuery.decodeSync(
      DistTagQuery.encodeSync(
        DistTagQuery.make({
          packageName,
          registry: 'https://registry.npmjs.org/',
        }),
      ),
    )
    const batchDistTagQuery = BatchDistTagQuery.decodeSync(
      BatchDistTagQuery.encodeSync(BatchDistTagQuery.make({ packages: [distTagQuery] })),
    )
    const accessQuery = AccessQuery.decodeSync(
      AccessQuery.encodeSync(
        AccessQuery.make({
          packageName,
          registry: 'https://registry.npmjs.org/',
        }),
      ),
    )
    const batchAccessQuery = BatchAccessQuery.decodeSync(
      BatchAccessQuery.encodeSync(BatchAccessQuery.make({ packages: [accessQuery] })),
    )
    const whoamiRequest = WhoamiRequest.decodeSync(
      WhoamiRequest.encodeSync(WhoamiRequest.make({ registry: 'https://registry.npmjs.org/' })),
    )
    const otpRequest = OtpRequest.decodeSync(
      OtpRequest.encodeSync(OtpRequest.make({ prompt: 'Enter npm OTP' })),
    )
    const trustedPublisherQuery = TrustedPublisherQuery.decodeSync(
      TrustedPublisherQuery.encodeSync(
        TrustedPublisherQuery.make({
          packageName,
          registry: 'https://registry.npmjs.org/',
        }),
      ),
    )
    const trustedPublisherSetup = TrustedPublisherSetup.decodeSync(
      TrustedPublisherSetup.encodeSync(
        TrustedPublisherSetup.make({
          packageName,
          provider: 'github',
          repository: 'jasonkuhrt/kitz',
          workflow: 'release.yml',
          registry: 'https://registry.npmjs.org/',
        }),
      ),
    )
    const artifactBuildRequest = ArtifactBuildRequest.decodeSync(
      ArtifactBuildRequest.encodeSync(
        ArtifactBuildRequest.make({
          packageDir,
          packageName,
          version,
          destination,
          manifestTransform: { version: '1.2.3' },
        }),
      ),
    )
    const packageManagerCommand = PackageManagerCommand.decodeSync(
      PackageManagerCommand.encodeSync(
        PackageManagerCommand.fromParts('pnpm', ['publish', '--dry-run']),
      ),
    )

    expect(subcommandProofRequest.subcommands).toEqual(['pack', 'publish', 'view'])
    expect(packRequestRoundTrip.packageName.moniker).toBe('@kitz/core')
    expect(publishRequestRoundTrip.capabilities).toEqual([...publishCapabilities])
    expect(Semver.toString(versionQuery.version)).toBe('1.2.3')
    expect(batchVersionQuery.versions).toHaveLength(1)
    expect(batchDistTagQuery.packages).toHaveLength(1)
    expect(batchAccessQuery.packages).toHaveLength(1)
    expect(distTagQuery.packageName.moniker).toBe('@kitz/core')
    expect(accessQuery.packageName.moniker).toBe('@kitz/core')
    expect(whoamiRequest.registry).toBe('https://registry.npmjs.org/')
    expect(otpRequest.prompt).toBe('Enter npm OTP')
    expect(trustedPublisherQuery.packageName.moniker).toBe('@kitz/core')
    expect(trustedPublisherSetup.provider).toBe('github')
    expect(artifactBuildRequest.manifestTransform).toEqual({ version: '1.2.3' })
    expect(packageManagerCommand.argv).toEqual(['pnpm', 'publish', '--dry-run'])
    expect(VersionProof.is(VersionProof.decodeSync(VersionProof.encodeSync(versionProof)))).toBe(
      true,
    )
    expect(DistTagProof.is(DistTagProof.decodeSync(DistTagProof.encodeSync(distTagProof)))).toBe(
      true,
    )
    expect(AccessProof.is(AccessProof.decodeSync(AccessProof.encodeSync(accessProof)))).toBe(true)
    expect(
      TrustedPublisherProof.is(
        TrustedPublisherProof.decodeSync(TrustedPublisherProof.encodeSync(trustedPublisherProof)),
      ),
    ).toBe(true)
    expect(
      RegistryTarballObservation.is(
        RegistryTarballObservation.decodeSync(
          RegistryTarballObservation.encodeSync(registryTarballObservation),
        ),
      ),
    ).toBe(true)
  })

  test('service tags use the release IO domain names', async () => {
    expect(releaseIoDomainValues).toEqual([
      'packagemanager',
      'git',
      'github',
      'env',
      'filesystem',
      'workflow',
      'sqlite',
      'packageregistry',
      'credentials',
      'releasemanager',
      'artifacter',
    ])
    for (const operation of publishingServiceOperationValues) {
      const domain = operation.split('.')[0] ?? ''
      expect(Schema.is(ReleaseIoDomain)(domain)).toBe(true)
    }

    const program = Effect.gen(function* () {
      const packageManager = yield* PackageManager
      const packageRegistry = yield* PackageRegistry
      const credentials = yield* Credentials
      const artifacter = yield* Artifacter
      const releaseManager = yield* ReleaseManager

      const driverVersion = yield* packageManager.version
      const subcommands = yield* packageManager.proveSubcommands(
        SubcommandProofRequest.make({
          binary: 'npm',
          subcommands: ['pack', 'publish', 'view'],
        }),
      )
      const packed = yield* packageManager.pack(packRequest)
      const dryRun = yield* packageManager.publishDryRun(publishRequest)
      const receipt = yield* packageManager.publish(publishRequest)
      const exactVersion = yield* packageRegistry.viewPackageVersion(
        VersionQuery.make({ packageName, version }),
      )
      const versionProofs = yield* packageRegistry.viewPackageVersions(
        BatchVersionQuery.make({
          versions: [VersionQuery.make({ packageName, version })],
        }),
      )
      const distTags = yield* packageRegistry.viewDistTags(DistTagQuery.make({ packageName }))
      const manyDistTags = yield* packageRegistry.viewManyDistTags(
        BatchDistTagQuery.make({ packages: [DistTagQuery.make({ packageName })] }),
      )
      const access = yield* packageRegistry.access(AccessQuery.make({ packageName }))
      const accessMany = yield* packageRegistry.accessMany(
        BatchAccessQuery.make({ packages: [AccessQuery.make({ packageName })] }),
      )
      const tarballMetadata = yield* packageRegistry.tarballMetadata(
        VersionQuery.make({ packageName, version }),
      )
      const whoami = yield* credentials.whoami(WhoamiRequest.make({}))
      const otp = yield* credentials.resolveOtp(OtpRequest.make({ prompt: 'OTP' }))
      const trustedPublishers = yield* credentials.trustedPublishers(
        TrustedPublisherQuery.make({ packageName }),
      )
      const trustedPublisherSetup = yield* credentials.setupTrustedPublisher(
        TrustedPublisherSetup.make({
          packageName,
          provider: 'github',
          repository: 'jasonkuhrt/kitz',
          workflow: 'release.yml',
        }),
      )
      const artifact = yield* artifacter.build(
        ArtifactBuildRequest.make({
          packageDir,
          packageName,
          version,
          destination,
          manifestTransform: { version: '1.2.3' },
        }),
      )

      return {
        access,
        accessMany,
        artifact,
        distTags,
        driverVersion,
        dryRun,
        exactVersion,
        manyDistTags,
        otp,
        packageManagerCapabilities: packageManager.capabilities,
        packed,
        receipt,
        releaseManager,
        subcommands,
        tarballMetadata,
        trustedPublishers,
        trustedPublisherSetup,
        versionProofs,
        whoami,
      }
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(PublishingLayer)))

    expect(DriverVersionProof.is(result.driverVersion)).toBe(true)
    expect(SubcommandProof.is(result.subcommands)).toBe(true)
    expect(PackedArtifact.is(result.packed)).toBe(true)
    expect(PublishDryRunProof.is(result.dryRun)).toBe(true)
    expect(PublishReceipt.is(result.receipt)).toBe(true)
    expect(Option.isSome(result.exactVersion)).toBe(true)
    expect(result.versionProofs.every(VersionProof.is)).toBe(true)
    expect(DistTagProof.is(result.distTags)).toBe(true)
    expect(result.manyDistTags.every(DistTagProof.is)).toBe(true)
    expect(AccessProof.is(result.access)).toBe(true)
    expect(result.accessMany.every(AccessProof.is)).toBe(true)
    expect(RegistryTarballObservation.is(result.tarballMetadata)).toBe(true)
    expect(AuthIdentityProof.is(result.whoami)).toBe(true)
    expect(Option.isSome(result.otp)).toBe(true)
    expect(TrustedPublisherProof.is(result.trustedPublishers)).toBe(true)
    expect(TrustedPublisherProof.is(result.trustedPublisherSetup)).toBe(true)
    expect(ArtifactManifest.is(result.artifact)).toBe(true)
    expect(HashSet.has(result.packageManagerCapabilities, 'pack:tarball')).toBe(true)
    expect(HashSet.has(result.packageManagerCapabilities, 'publish:tarball')).toBe(true)
    expect(result.releaseManager.prove).toBe(Proof.prove)
  })

  test('service operation failures are closed over known release IO operations', () => {
    const error = new PublishingCapabilityError({
      context: {
        provider: 'npm',
        operation: 'packageregistry.view-package-version',
      },
    })

    expect(error.message).toBe('Provider npm cannot prove packageregistry.view-package-version')
    expect(() => Schema.decodeUnknownSync(PublishingOperation)('pack-driver.pack')).toThrow()
    expect(() => Schema.decodeUnknownSync(PublishingOperation)('registry-client.magic')).toThrow()
  })

  test('schemas reject malformed publishing IO payloads before services run', () => {
    expect(() =>
      PublishRequest.decodeSync({
        tarball: '/repo/.release/artifacts/kitz-core-1.2.3.tgz',
        packageName: '@kitz/core',
        version: '1.2.3',
        distTag: 'latest',
        capabilities: ['publish:magic'],
      }),
    ).toThrow()

    expect(() =>
      AccessProof.decodeSync({
        packageName: '@kitz/core',
        access: 'public',
        observedAt,
      }),
    ).toThrow()
  })
})
