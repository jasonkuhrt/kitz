import { Err } from '@kitz/core'
import { Schema as S } from 'effect'
import { PublishCapability } from './models/capability.js'
import type { ReleaseIoOperationCode } from './models/domain.js'

const baseTags = ['kit', 'release', 'publishing'] as const

export const publishingServiceOperationValues = [
  'artifacter.build',
  'credentials.resolve-otp',
  'credentials.setup-trusted-publisher',
  'credentials.trusted-publishers',
  'credentials.whoami',
  'packagemanager.pack',
  'packagemanager.prove-subcommands',
  'packagemanager.publish',
  'packagemanager.publish-dry-run',
  'packagemanager.version',
  'packageregistry.access',
  'packageregistry.access-many',
  'packageregistry.tarball-metadata',
  'packageregistry.view-dist-tags',
  'packageregistry.view-many-dist-tags',
  'packageregistry.view-package-version',
  'packageregistry.view-package-versions',
  'releasemanager.execute',
  'releasemanager.prove',
  'releasemanager.read-proof-for-plan',
  'releasemanager.rehearse',
  'releasemanager.resume',
  'releasemanager.status',
] as const satisfies ReadonlyArray<ReleaseIoOperationCode>

export const PublishingServiceOperation = S.Literals(publishingServiceOperationValues)
export type PublishingServiceOperation = typeof PublishingServiceOperation.Type

export const PublishingOperation = S.Union([PublishCapability, PublishingServiceOperation])
export type PublishingOperation = typeof PublishingOperation.Type

const PublishingCapabilityErrorContext = S.Struct({
  provider: S.String,
  operation: PublishingOperation,
})

export const PublishingCapabilityError: Err.TaggedContextualErrorClass<
  'PublishingCapabilityError',
  typeof baseTags,
  typeof PublishingCapabilityErrorContext,
  undefined
> = Err.TaggedContextualError('PublishingCapabilityError', baseTags, {
  context: PublishingCapabilityErrorContext,
  message: (ctx) => `Provider ${ctx.provider} cannot prove ${ctx.operation}`,
})

export type PublishingCapabilityError = InstanceType<typeof PublishingCapabilityError>

export type All = PublishingCapabilityError
