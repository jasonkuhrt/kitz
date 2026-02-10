import { Option } from 'effect'
import type { PackageLog } from './generate.js'

export interface JsonPackageLog {
  readonly package: string
  readonly currentVersion: string | null
  readonly nextVersion: string
  readonly bump: string
  readonly changelog: string
  readonly hasBreakingChanges: boolean
}

export const toJsonLogs = (logs: readonly PackageLog[]): readonly JsonPackageLog[] =>
  logs.map((log) => ({
    package: log.package.name.moniker,
    currentVersion: Option.isSome(log.currentVersion) ? log.currentVersion.value.toString() : null,
    nextVersion: log.nextVersion.toString(),
    bump: log.bump,
    changelog: log.changelog.markdown,
    hasBreakingChanges: log.changelog.hasBreakingChanges,
  }))

export const renderMarkdownLogs = (logs: readonly PackageLog[]): string =>
  logs.map((log) => log.changelog.markdown).join('\n\n')
