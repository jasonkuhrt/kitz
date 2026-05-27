import { Pkg } from '@kitz/pkg'
import { Array as A, HashSet } from 'effect'
import * as Capability from '../models/capability.js'

export const id = 'bun'

export interface BunPublishCommandOptions {
  readonly target?: string
  readonly tag?: string
  readonly registry?: string
  readonly access?: 'public' | 'restricted'
  readonly otp?: string
  readonly authType?: 'web' | 'legacy'
  readonly dryRun?: boolean
  readonly tolerateRepublish?: boolean
}

export const capabilities = HashSet.fromIterable(
  A.filter(
    Capability.publishCapabilityValues,
    (capability) =>
      Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id }).isSupported,
  ),
)

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: { readonly destination?: string } = {}) =>
  Pkg.Manager.Command.fromParts('bun', [
    'pm',
    'pack',
    ...(params.destination !== undefined ? ['--destination', params.destination] : []),
  ])

export const buildPublishCommand = (params: BunPublishCommandOptions) =>
  Pkg.Manager.Command.fromParts('bun', [
    'publish',
    ...(params.target !== undefined ? [params.target] : []),
    ...(params.tag !== undefined ? ['--tag', params.tag] : []),
    ...(params.registry !== undefined ? ['--registry', params.registry] : []),
    ...(params.access !== undefined ? ['--access', params.access] : []),
    ...(params.otp !== undefined ? ['--otp', params.otp] : []),
    ...(params.authType !== undefined ? ['--auth-type', params.authType] : []),
    ...(params.dryRun === true ? ['--dry-run'] : []),
    ...(params.tolerateRepublish === true ? ['--tolerate-republish'] : []),
  ])
