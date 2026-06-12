import { Pkg } from '@kitz/pkg'
import { PublishDriverId } from './models/driver-id.js'

export const PackageManagerAgent = PublishDriverId
export type PackageManagerAgent = typeof PackageManagerAgent.Type

export const PackageManagerCommand = Pkg.Manager.Command
export type PackageManagerCommand = Pkg.Manager.Command

export const agentFromProjectManager = (
  manager: Pkg.Manager.PackageManager,
): PackageManagerAgent => {
  switch (manager) {
    case 'bun':
    case 'npm':
    case 'pnpm':
      return manager
    // 'unknown' | 'yarn'
    default:
      return 'npm'
  }
}
