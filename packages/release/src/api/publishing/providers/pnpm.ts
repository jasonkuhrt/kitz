import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import * as Capability from '../models/capability.js'

export const id = 'pnpm'

export type PnpmPublishCommandOptions = NpmRegistry.Argv.PnpmPublishArgvOptions
export type PnpmPackCommandOptions = NpmRegistry.Argv.PnpmPackArgvOptions

export const capabilityResult = (capability: Capability.PublishCapability) =>
  Capability.CapabilityMatrixRow.resultForProvider({ capability, provider: id })

export const buildPackCommand = (params: PnpmPackCommandOptions) =>
  Pkg.Manager.Command.fromParts('pnpm', NpmRegistry.Argv.pnpmPack(params))

export const buildPublishCommand = (params: PnpmPublishCommandOptions) =>
  Pkg.Manager.Command.fromParts('pnpm', NpmRegistry.Argv.pnpmPublish(params))
