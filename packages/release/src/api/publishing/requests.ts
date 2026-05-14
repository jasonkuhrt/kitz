import type { Fs } from '@kitz/fs'
import type { Pkg } from '@kitz/pkg'
import type { Semver } from '@kitz/semver'
import type { PublishCapability } from './models/capability.js'

export interface SubcommandProofRequest {
  readonly binary: string
  readonly subcommands: readonly string[]
}

export interface PackRequest {
  readonly packageDir: Fs.Path.AbsDir
  readonly packageName: Pkg.Moniker.Moniker
  readonly version: Semver.Semver
  readonly destination: Fs.Path.AbsDir
}

export interface PublishRequest {
  readonly tarball: Fs.Path.AbsFile
  readonly packageName: Pkg.Moniker.Moniker
  readonly version: Semver.Semver
  readonly distTag: string
  readonly registry?: string
  readonly access?: 'public' | 'restricted'
  readonly otp?: string
  readonly provenance?: boolean
  readonly capabilities: readonly PublishCapability[]
}

export interface VersionQuery {
  readonly packageName: Pkg.Moniker.Moniker
  readonly version: Semver.Semver
  readonly registry?: string
}

export interface BatchVersionQuery {
  readonly versions: readonly VersionQuery[]
}

export interface DistTagQuery {
  readonly packageName: Pkg.Moniker.Moniker
  readonly registry?: string
}

export interface BatchDistTagQuery {
  readonly packages: readonly DistTagQuery[]
}

export interface AccessQuery {
  readonly packageName: Pkg.Moniker.Moniker
  readonly registry?: string
}

export interface BatchAccessQuery {
  readonly packages: readonly AccessQuery[]
}

export interface WhoamiRequest {
  readonly registry?: string
}

export interface OtpRequest {
  readonly prompt: string
}

export interface TrustedPublisherQuery {
  readonly packageName: Pkg.Moniker.Moniker
  readonly registry?: string
}

export interface TrustedPublisherSetup {
  readonly packageName: Pkg.Moniker.Moniker
  readonly provider: 'github' | 'gitlab' | 'circleci'
  readonly repository: string
  readonly workflow: string
  readonly registry?: string
}
