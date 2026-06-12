import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import * as ReleaseClock from '../clock.js'
import { Digest, sha256Bytes } from '../digest.js'
import type { PublishDriverId } from '../publishing/models/driver-id.js'
import {
  verifyRegistryObservation,
  type PublishVerificationResult,
} from '../publishing/verification.js'
import {
  ArtifactManifest,
  PlanDigest,
  PublishReceipt,
  RegistryObservation,
} from '../release-contract.js'
import { artifactPathFor, type ReleaseInfo } from './publish.js'

export interface RegistryPublicationRequest {
  readonly packageName: string
  readonly nextVersion: string
  readonly releaseInfo: ReleaseInfo
  readonly planDigest?: string
  readonly packDriver: PublishDriverId
  readonly registry?: string
  readonly distTag: string
  readonly official: boolean
}

export interface RegistryPublicationVerification extends PublishVerificationResult {
  readonly artifact: ArtifactManifest
  readonly observation: RegistryObservation
}

export const verifyRegistryPublication = (request: RegistryPublicationRequest) =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const cli = yield* NpmRegistry.NpmCli
    const tarball = artifactPathFor(
      env.cwd,
      request.releaseInfo,
      request.planDigest === undefined ? undefined : { planDigest: request.planDigest },
    )
    const tarballBytes = yield* Fs.read(tarball)
    const tarballSha256 = sha256Bytes(tarballBytes)
    const observed = yield* cli.observeVersion(request.packageName, request.nextVersion, {
      ...(request.registry !== undefined ? { registry: request.registry } : {}),
      downloadTarball: request.official,
    })
    const planDigest = PlanDigest.make({
      algorithm: 'sha256',
      value: request.planDigest ?? 'unknown',
    })
    const observation = RegistryObservation.make({
      packageName: Pkg.Moniker.parse(request.packageName),
      version: Semver.fromString(request.nextVersion),
      registry: request.registry ?? 'https://registry.npmjs.org/',
      observedAt: yield* ReleaseClock.now,
      versionMetadata: observed.versionMetadata,
      distTags: { ...observed.distTags },
      ...(observed.tarballUrl !== undefined ? { tarballUrl: observed.tarballUrl } : {}),
      ...(observed.shasum !== undefined ? { shasum: observed.shasum } : {}),
      ...(observed.integrity !== undefined ? { integrity: observed.integrity } : {}),
      ...(observed.downloadedTarballSha256 !== undefined
        ? {
            downloadedTarballSha256: Digest.make({
              algorithm: 'sha256',
              value: observed.downloadedTarballSha256,
            }),
          }
        : {}),
    })
    const receipt = PublishReceipt.make({
      schemaVersion: 1,
      planDigest,
      tarballSha256,
      observation,
      verifiedAt: yield* ReleaseClock.now,
    })
    const artifact = ArtifactManifest.make({
      schemaVersion: 1,
      planDigest,
      packageName: request.releaseInfo.package.name,
      version: request.releaseInfo.nextVersion,
      driver: request.packDriver,
      tarball,
      sha256: tarballSha256,
      sizeBytes: tarballBytes.length,
      manifest: {
        name: request.packageName,
        version: request.nextVersion,
      },
      packlist: [],
      rewrittenFields: ['version', 'dependencies', 'devDependencies', 'peerDependencies'],
    })

    return {
      ...verifyRegistryObservation({
        artifact,
        observation,
        distTag: request.distTag,
        official: request.official,
        requestedAccess: 'public',
        receipt,
      }),
      artifact,
      observation,
    }
  })
