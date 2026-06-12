import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import * as Capability from '../models/capability.js'

export const id = 'bun'

export type BunPublishCommandOptions = NpmRegistry.Argv.BunPublishArgvOptions

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: NpmRegistry.Argv.BunPackArgvOptions = {}) =>
  Pkg.Manager.Command.fromParts('bun', NpmRegistry.Argv.bunPack(params))

export const buildPublishCommand = (params: BunPublishCommandOptions = {}) =>
  Pkg.Manager.Command.fromParts('bun', NpmRegistry.Argv.bunPublish(params))
