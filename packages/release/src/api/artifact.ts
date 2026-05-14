import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Option, Schema } from 'effect'
import { sha256Bytes } from './digest.js'
import {
  preparePackageArtifact,
  type PreparedArtifact,
  type PublishError,
  type ReleaseInfo,
} from './executor/publish.js'
import type { Plan } from './planner/models/plan.js'
import { digestForPlan } from './proof.js'
import { ArtifactManifest } from './release-contract.js'

const artifactDir = Fs.Path.RelDir.fromString('./.release/artifacts/')
const artifactManifestFile = Fs.Path.RelFile.fromString('./manifest.json')

export const manifestPathFor = (cwd: Fs.Path.AbsDir, plan: Plan): Fs.Path.AbsFile =>
  Fs.Path.join(
    Fs.Path.join(cwd, artifactDir),
    Fs.Path.join(
      Fs.Path.RelDir.fromString(`./${digestForPlan(plan).value}/`),
      artifactManifestFile,
    ),
  )

const manifestRelPath = (path: string): Fs.Path.RelFile =>
  Fs.Path.RelFile.fromString(path.startsWith('./') ? path : `./${path}`)

export const releaseInfosForPlan = (plan: Plan): ReleaseInfo[] =>
  [...plan.releases, ...plan.cascades].map((item) => ({
    package: item.package,
    nextVersion: item.nextVersion,
  }))

export const makeManifestFromPrepared = (
  plan: Plan,
  artifacts: readonly PreparedArtifact[],
): Effect.Effect<ArtifactManifest[], PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const manifests: ArtifactManifest[] = []

    for (const artifact of artifacts) {
      const tarballBytes = yield* fs.readFile(Fs.Path.toString(artifact.tarball))
      manifests.push(
        ArtifactManifest.make({
          schemaVersion: 1,
          packageName: artifact.package.name,
          version: artifact.nextVersion,
          driver: plan.publishIntent?.profile.packDriver ?? 'npm',
          tarball: artifact.tarball,
          sha256: sha256Bytes(tarballBytes),
          sizeBytes: tarballBytes.length,
          manifest: {
            name: artifact.package.name.moniker,
            version: Semver.toString(artifact.nextVersion),
          },
          packlist: (artifact.packMetadata?.files ?? []).map((file) => manifestRelPath(file.path)),
          rewrittenFields: ['version', 'dependencies', 'devDependencies', 'peerDependencies'],
          ...(artifact.packMetadata?.integrity !== undefined
            ? { npmRegistryIntegrity: artifact.packMetadata.integrity }
            : {}),
          ...(artifact.packMetadata?.shasum !== undefined
            ? { npmRegistryShasum: artifact.packMetadata.shasum }
            : {}),
        }),
      )
    }

    return manifests
  })

export const makeManifestFromPlan = (plan: Plan, cwd: Fs.Path.AbsDir): ArtifactManifest[] =>
  releaseInfosForPlan(plan).map((release) =>
    ArtifactManifest.make({
      schemaVersion: 1,
      packageName: release.package.name,
      version: release.nextVersion,
      driver: plan.publishIntent?.profile.packDriver ?? 'npm',
      tarball: Fs.Path.AbsFile.fromString(
        `${Fs.Path.toString(cwd)}.release/artifacts/${digestForPlan(plan).value}/${release.package.name.moniker
          .replace(/^@/u, '')
          .replace(/\//gu, '-')}-${Semver.toString(release.nextVersion)}.tgz`,
      ),
      sha256: sha256Bytes(new Uint8Array()),
      sizeBytes: 0,
      manifest: {
        name: release.package.name.moniker,
        version: Semver.toString(release.nextVersion),
      },
      packlist: [],
      rewrittenFields: ['version'],
    }),
  )

export const writeManifest = (
  plan: Plan,
  manifests: readonly ArtifactManifest[],
): Effect.Effect<void, PlatformError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const path = manifestPathFor(env.cwd, plan)
    yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(path)), { recursive: true })
    yield* fs.writeFileString(
      Fs.Path.toString(path),
      `${JSON.stringify(Schema.encodeSync(Schema.Array(ArtifactManifest))([...manifests]), null, 2)}\n`,
    )
  })

export const readManifest = (
  plan: Plan,
): Effect.Effect<
  Option.Option<readonly ArtifactManifest[]>,
  PlatformError | Schema.SchemaError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const path = manifestPathFor(env.cwd, plan)
    const exists = yield* fs.exists(Fs.Path.toString(path))
    if (!exists) return Option.none()
    const text = yield* fs.readFileString(Fs.Path.toString(path))
    const decoded = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(Schema.Array(ArtifactManifest)),
    )(text)
    return Option.some(decoded)
  })

export const rehearse = (
  plan: Plan,
): Effect.Effect<
  ArtifactManifest[],
  PublishError | PlatformError | Resource.ResourceError,
  Env.Env | FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    const releases = releaseInfosForPlan(plan)
    const preparedArtifacts: PreparedArtifact[] = []

    for (const release of releases) {
      preparedArtifacts.push(yield* preparePackageArtifact(release, releases))
    }

    const manifests = yield* makeManifestFromPrepared(plan, preparedArtifacts)
    yield* writeManifest(plan, manifests)
    return manifests
  })
