import { Schema } from 'effect'

export const releaseIoDomainValues = [
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
] as const

export const ReleaseIoDomain = Schema.Literals(releaseIoDomainValues)
export type ReleaseIoDomain = typeof ReleaseIoDomain.Type
export type ReleaseIoOperationCode = `${ReleaseIoDomain}.${string}`
