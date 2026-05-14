import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import type { ArtifactManifest, PublishReceipt, RegistryObservation } from '../release-contract.js'

export interface PublishVerificationIssue {
  readonly code: string
  readonly detail: string
}

export interface PublishVerificationResult {
  readonly receipt: PublishReceipt
  readonly issues: readonly PublishVerificationIssue[]
}

const moniker = (value: Pkg.Moniker.Moniker): string => value.moniker
const version = (value: Semver.Semver): string => value.toString()

export const verifyRegistryObservation = (params: {
  readonly artifact: ArtifactManifest
  readonly observation: RegistryObservation
  readonly distTag: string
  readonly official: boolean
  readonly requestedAccess?: 'public' | 'restricted'
  readonly receipt: PublishReceipt
}): PublishVerificationResult => {
  const issues: PublishVerificationIssue[] = []
  const artifactPackage = moniker(params.artifact.packageName)
  const observedPackage = moniker(params.observation.packageName)
  const artifactVersion = version(params.artifact.version)
  const observedVersion = version(params.observation.version)

  if (artifactPackage !== observedPackage || artifactVersion !== observedVersion) {
    issues.push({
      code: 'release.registry.version-mismatch',
      detail: `${observedPackage}@${observedVersion} does not match ${artifactPackage}@${artifactVersion}.`,
    })
  }

  if (params.observation.distTags[params.distTag] !== artifactVersion) {
    issues.push({
      code: 'release.registry.dist-tag-mismatch',
      detail: `${params.distTag} does not point at ${artifactPackage}@${artifactVersion}.`,
    })
  }

  if (
    params.requestedAccess !== undefined &&
    params.observation.accessStatus !== undefined &&
    params.observation.accessStatus !== params.requestedAccess
  ) {
    issues.push({
      code: 'release.registry.access-mismatch',
      detail: `Registry access is ${params.observation.accessStatus}, not ${params.requestedAccess}.`,
    })
  }

  if (
    params.observation.shasum !== undefined &&
    params.artifact.npmRegistryShasum !== undefined &&
    params.observation.shasum !== params.artifact.npmRegistryShasum
  ) {
    issues.push({
      code: 'release.registry.shasum-mismatch',
      detail: 'Registry shasum differs from rehearsed npm pack metadata.',
    })
  }

  if (
    params.observation.integrity !== undefined &&
    params.artifact.npmRegistryIntegrity !== undefined &&
    params.observation.integrity !== params.artifact.npmRegistryIntegrity
  ) {
    issues.push({
      code: 'release.registry.integrity-mismatch',
      detail: 'Registry integrity differs from rehearsed npm pack metadata.',
    })
  }

  if (
    params.official &&
    params.observation.downloadedTarballSha256?.value !== params.artifact.sha256.value
  ) {
    issues.push({
      code: 'release.registry.tarball-sha256-mismatch',
      detail: 'Official registry tarball bytes do not match the rehearsed artifact.',
    })
  }

  if (params.receipt.tarballSha256.value !== params.artifact.sha256.value) {
    issues.push({
      code: 'release.receipt.tarball-sha256-mismatch',
      detail: 'Publish receipt is not bound to the rehearsed artifact SHA-256.',
    })
  }

  return {
    receipt: params.receipt,
    issues,
  }
}
