import type { Option } from 'effect'
import type { Pkg } from '@kitz/pkg'
import type { Semver } from '@kitz/semver'
import type { Digest } from '../digest.js'

export interface VersionProof {
  readonly packageName: Pkg.Moniker.Moniker
  readonly version: Semver.Semver
  readonly exists: boolean
  readonly observedAt: string
}

export interface DistTagProof {
  readonly packageName: Pkg.Moniker.Moniker
  readonly distTags: Readonly<Record<string, string>>
  readonly observedAt: string
}

export interface AccessProof {
  readonly packageName: Pkg.Moniker.Moniker
  readonly access: Option.Option<'public' | 'restricted'>
  readonly observedAt: string
}

export interface AuthIdentityProof {
  readonly provider: string
  readonly username: string
  readonly observedAt: string
}

export interface OtpSecret {
  readonly value: string
}

export interface TrustedPublisherProof {
  readonly packageName: Pkg.Moniker.Moniker
  readonly provider: string
  readonly repository: string
  readonly workflow: string
  readonly observedAt: string
}

export interface RegistryTarballObservation {
  readonly packageName: Pkg.Moniker.Moniker
  readonly version: Semver.Semver
  readonly integrity?: string
  readonly shasum?: string
  readonly sha256?: Digest
  readonly observedAt: string
}
