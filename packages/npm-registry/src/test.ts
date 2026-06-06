/**
 * Tag-owned test double for the {@link NpmCli} service.
 *
 * `Test.make(config?)` returns a {@link Test.Mock} driver whose every method is
 * pre-scripted to succeed with happy-path defaults (mirroring
 * {@link NpmCliDryRun}). Callers wire it in with `driver.$test.layer()`,
 * inspect calls via `driver.<method>.calls`, and inject failures on any method
 * without re-stubbing the whole interface — e.g. `driver.whoami.everyFail(error)`.
 *
 * @example
 * ```ts
 * import { make as makeNpmCliTest } from '@kitz/npm-registry/test'
 * import { NpmRegistry } from '@kitz/npm-registry'
 *
 * const npm = makeNpmCliTest({ whoamiUser: 'alice' })
 * npm.whoami.everyFail(
 *   new NpmRegistry.NpmCliError({ context: { operation: 'whoami' }, cause: new Error('x') }),
 * )
 * const layer = npm.$test.layer()
 * ```
 *
 * @category Testing
 */

import { Fs } from '@kitz/fs'
import { Test } from '@kitz/test'
import type { AccessStatus, PackResult, RegistryVersionObservation } from './cli.js'
import { NpmCli } from './service.js'

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

/**
 * Happy-path defaults for the NpmCli test double.
 *
 * Mirrors the canned values of {@link NpmCliDryRun}: `'dry-run-user'`, a fixed
 * tarball, `hasVersion → true`, `getAccessStatus → 'public'`, and empty access
 * listings.
 *
 * @category Testing
 */
export interface NpmCliTestConfig {
  /** Username reported by `whoami` (default `'dry-run-user'`). */
  readonly whoamiUser?: string
  /** Result reported by `pack` (default a fixed dry-run tarball). */
  readonly packResult?: PackResult
  /** Result reported by `hasVersion` (default `true`). */
  readonly hasVersion?: boolean
  /** Access status reported by `getAccessStatus` (default `'public'`). */
  readonly accessStatus?: AccessStatus
  /** Package listing reported by `listAccessPackages` (default `{}`). */
  readonly accessPackages?: Readonly<Record<string, string>>
  /** Collaborator listing reported by `listAccessCollaborators` (default `{}`). */
  readonly accessCollaborators?: Readonly<Record<string, string>>
  /** Observation reported by `observeVersion` (default a fixed observation). */
  readonly observation?: RegistryVersionObservation
}

const defaultPackResult = (): PackResult => ({
  filename: 'dry-run-package-0.0.0.tgz',
  tarball: Fs.Path.AbsFile.fromString('/dry-run/dry-run-package-0.0.0.tgz'),
})

const defaultObservation = (): RegistryVersionObservation => ({
  versionMetadata: {
    name: 'dry-run-package',
    version: '0.0.0',
    dist: { tarball: `${DEFAULT_REGISTRY}dry-run-package/-/0.0.0.tgz` },
  },
  distTags: { latest: '0.0.0' },
  tarballUrl: `${DEFAULT_REGISTRY}dry-run-package/-/0.0.0.tgz`,
})

/**
 * Build a happy-path NpmCli test driver.
 *
 * @category Testing
 */
export const make = (config: NpmCliTestConfig = {}): Test.Mock.Driver<typeof NpmCli> => {
  const npm = Test.Mock.make(NpmCli)

  npm.whoami.everySuccess(config.whoamiUser ?? 'dry-run-user')
  npm.pack.everySuccess(config.packResult ?? defaultPackResult())
  npm.publish.everySuccess(undefined)
  npm.hasVersion.everySuccess(config.hasVersion ?? true)
  npm.observeVersion.everySuccess(config.observation ?? defaultObservation())
  npm.listAccessPackages.everySuccess(config.accessPackages ?? {})
  npm.listAccessCollaborators.everySuccess(config.accessCollaborators ?? {})
  npm.getAccessStatus.everySuccess(config.accessStatus ?? 'public')

  return npm
}
