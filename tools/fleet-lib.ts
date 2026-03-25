// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
// oxlint-disable-next-line kitz/no-nodejs-builtin-imports
import { basename, dirname, join } from 'node:path'
import { Schema } from 'effect'

export type PackageManager = 'bun' | 'pnpm' | 'npm' | 'yarn' | 'unknown'
export type WorkspaceKind = 'workspace' | 'single-package'
export type OpportunityStatus = 'adopt' | 'expand-existing' | 'missing'

export interface DependencyMap {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
}

const DependencyRecordSchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
})
const WorkspacesSchema = Schema.Union(
  Schema.Array(Schema.String),
  Schema.Struct({
    packages: Schema.optional(Schema.Array(Schema.String)),
  }),
)
const PackageJsonManifestSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  packageManager: Schema.optional(Schema.String),
  workspaces: Schema.optional(WorkspacesSchema),
  dependencies: Schema.optional(DependencyRecordSchema),
  devDependencies: Schema.optional(DependencyRecordSchema),
  peerDependencies: Schema.optional(DependencyRecordSchema),
  optionalDependencies: Schema.optional(DependencyRecordSchema),
})

export type PackageJsonManifest = Schema.Schema.Type<typeof PackageJsonManifestSchema>

const decodeManifest = Schema.decodeUnknownSync(Schema.parseJson(PackageJsonManifestSchema))

export interface KitzOpportunity {
  readonly id: string
  readonly status: OpportunityStatus
  readonly target: string
  readonly sourceDependencies: readonly string[]
  readonly note: string
}

export interface RepoInventoryEntry {
  readonly repoDirName: string
  readonly repoPath: string
  readonly packageName: string | null
  readonly packageManager: PackageManager
  readonly workspaceKind: WorkspaceKind
  readonly usesEffect: boolean
  readonly usesLegacyKit: boolean
  readonly currentKitzPackages: readonly string[]
  readonly opportunities: readonly KitzOpportunity[]
}

export interface FleetInventory {
  readonly baseDir: string
  readonly entries: readonly RepoInventoryEntry[]
}

export interface DiscoverRepoDirectoriesOptions {
  readonly includeSelf?: boolean
  readonly onlyRepoNames?: readonly string[]
  readonly selfRepoName?: string
}

interface OpportunityHint {
  readonly id: string
  readonly status: OpportunityStatus
  readonly target: string
  readonly note: string
  readonly dependencyNames?: readonly string[]
  readonly dependencyPrefixes?: readonly string[]
}

const LOCKFILE_TO_MANAGER: ReadonlyArray<readonly [string, PackageManager]> = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
]

const OPPORTUNITY_HINTS: readonly OpportunityHint[] = [
  {
    id: 'yaml',
    status: 'adopt',
    target: '@kitz/yaml',
    note: 'Replace raw YAML parsing/stringifying with a schema-first kitz surface.',
    dependencyNames: ['yaml'],
  },
  {
    id: 'plist',
    status: 'missing',
    target: '@kitz/plist',
    note: 'Missing property-list codec/resource package.',
    dependencyNames: ['plist', '@plist/binary.parse', '@plist/binary.serialize'],
    dependencyPrefixes: ['@plist/'],
  },
  {
    id: 'xml',
    status: 'missing',
    target: '@kitz/xml',
    note: 'Missing XML codec/resource package.',
    dependencyNames: ['fast-xml-parser', 'xml2js', 'xmlbuilder2'],
  },
  {
    id: 'json-patch',
    status: 'missing',
    target: '@kitz/json-patch',
    note: 'Missing typed JSON patch/diff surface.',
    dependencyNames: ['fast-json-patch', 'json-patch'],
  },
  {
    id: 'markdown',
    status: 'missing',
    target: '@kitz/markdown',
    note: 'Missing markdown document/AST/table-of-contents surface.',
    dependencyNames: ['markdown-toc', 'remark', 'marked', 'micromark'],
  },
  {
    id: 'glob',
    status: 'expand-existing',
    target: '@kitz/fs',
    note: 'Expand existing filesystem/query surface rather than adding another glob dependency.',
    dependencyNames: ['fast-glob', 'tinyglobby', 'picomatch'],
  },
  {
    id: 'schema',
    status: 'expand-existing',
    target: '@kitz/sch',
    note: 'Strengthen schema/runtime validation migration path into kitz schema tooling.',
    dependencyNames: ['ajv', 'zod'],
  },
  {
    id: 'graphql',
    status: 'missing',
    target: '@kitz/graphql',
    note: 'Potential GraphQL typed tooling surface.',
    dependencyNames: ['graphql', 'graffle', '@graphql-inspector/core'],
  },
]

const parseManifest = (packageJsonPath: string): PackageJsonManifest => {
  const content = readFileSync(packageJsonPath, 'utf8')
  return decodeManifest(content)
}

const normalizePackageManager = (value: string | undefined): PackageManager => {
  if (!value) return 'unknown'
  const name = value.trim().toLowerCase().split('@', 1)[0]

  switch (name) {
    case 'bun':
    case 'pnpm':
    case 'npm':
    case 'yarn':
      return name
    default:
      return 'unknown'
  }
}

export const inferPackageManager = (
  repoPath: string,
  manifest: PackageJsonManifest,
): PackageManager => {
  const fromManifest = normalizePackageManager(manifest.packageManager)
  if (fromManifest !== 'unknown') {
    return fromManifest
  }

  for (const [lockfile, packageManager] of LOCKFILE_TO_MANAGER) {
    if (existsSync(join(repoPath, lockfile))) {
      return packageManager
    }
  }

  return 'unknown'
}

const normalizeWorkspaces = (workspaces: PackageJsonManifest['workspaces']): readonly string[] => {
  if (Array.isArray(workspaces)) {
    return workspaces
  }

  if (workspaces && Array.isArray(workspaces.packages)) {
    return workspaces.packages
  }

  return []
}

const collectDependencyNames = (manifest: DependencyMap): readonly string[] => {
  const collected = new Set<string>()

  for (const field of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ]) {
    for (const name of Object.keys(field ?? {})) {
      collected.add(name)
    }
  }

  return [...collected].sort()
}

const matchesOpportunityHint = (dependency: string, hint: OpportunityHint): boolean => {
  if (hint.dependencyNames?.includes(dependency)) {
    return true
  }

  return hint.dependencyPrefixes?.some((prefix) => dependency.startsWith(prefix)) ?? false
}

export const inferOpportunities = (dependencies: readonly string[]): readonly KitzOpportunity[] => {
  const results: KitzOpportunity[] = []

  for (const hint of OPPORTUNITY_HINTS) {
    const matched = dependencies.filter((dependency) => matchesOpportunityHint(dependency, hint))

    if (matched.length === 0) {
      continue
    }

    results.push({
      id: hint.id,
      status: hint.status,
      target: hint.target,
      sourceDependencies: matched,
      note: hint.note,
    })
  }

  return results
}

export const scanRepo = (repoPath: string): RepoInventoryEntry => {
  const manifest = parseManifest(join(repoPath, 'package.json'))
  const dependencies = collectDependencyNames(manifest)
  const currentKitzPackages = dependencies
    .filter((dependency) => dependency === 'kitz' || dependency.startsWith('@kitz/'))
    .sort()

  return {
    repoDirName: basename(repoPath),
    repoPath,
    packageName: manifest.name ?? null,
    packageManager: inferPackageManager(repoPath, manifest),
    workspaceKind:
      normalizeWorkspaces(manifest.workspaces).length > 0 ? 'workspace' : 'single-package',
    usesEffect: dependencies.some(
      (dependency) => dependency === 'effect' || dependency.startsWith('@effect/'),
    ),
    usesLegacyKit: dependencies.includes('@wollybeard/kit'),
    currentKitzPackages,
    opportunities: inferOpportunities(dependencies),
  }
}

export const discoverRepoDirectories = (
  baseDir: string,
  options: DiscoverRepoDirectoriesOptions = {},
): readonly string[] => {
  const onlyRepoNames =
    options.onlyRepoNames && options.onlyRepoNames.length > 0
      ? new Set(options.onlyRepoNames)
      : null
  const entries = readdirSync(baseDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith('.'))
    .filter((entry) => (options.includeSelf ? true : entry.name !== options.selfRepoName))
    .filter((entry) => (onlyRepoNames ? onlyRepoNames.has(entry.name) : true))
    .map((entry) => join(baseDir, entry.name))
    .filter((entryPath) => {
      try {
        return statSync(entryPath).isDirectory() && existsSync(join(entryPath, 'package.json'))
      } catch {
        return false
      }
    })
    .sort((left, right) => basename(left).localeCompare(basename(right)))
}

const renderOpportunity = (opportunity: KitzOpportunity): string =>
  `${opportunity.status} ${opportunity.target} <- ${opportunity.sourceDependencies.join(', ')}`

export const renderTextReport = (inventory: FleetInventory): string => {
  const lines: string[] = []
  const currentConsumers = inventory.entries.filter((entry) => entry.currentKitzPackages.length > 0)
  const effectRepos = inventory.entries.filter((entry) => entry.usesEffect)
  const legacyKitRepos = inventory.entries.filter((entry) => entry.usesLegacyKit)

  lines.push(
    `Kitz fleet scan: ${inventory.entries.length} repos under ${inventory.baseDir}`,
    `Current kitz consumers: ${currentConsumers.length}`,
    `Effect-based repos: ${effectRepos.length}`,
    `Legacy @wollybeard/kit repos: ${legacyKitRepos.length}`,
    '',
  )

  for (const entry of inventory.entries) {
    lines.push(
      `${entry.repoDirName} [${entry.packageManager}, ${entry.workspaceKind}]`,
      `  package: ${entry.packageName ?? '(unnamed)'}`,
      `  signals: effect=${entry.usesEffect ? 'yes' : 'no'}, legacy-kit=${entry.usesLegacyKit ? 'yes' : 'no'}`,
      `  kitz: ${entry.currentKitzPackages.length > 0 ? entry.currentKitzPackages.join(', ') : 'none'}`,
    )

    if (entry.opportunities.length === 0) {
      lines.push('  opportunities: none')
    } else {
      lines.push('  opportunities:')
      for (const opportunity of entry.opportunities) {
        lines.push(`    - ${renderOpportunity(opportunity)}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export const renderMarkdownReport = (inventory: FleetInventory): string => {
  const lines: string[] = []

  lines.push('# Kitz Fleet Scan', '')
  lines.push(`Base directory: \`${inventory.baseDir}\``, '')
  lines.push(
    '| Repo | Package | PM | Kind | Effect | Legacy Kit | Current Kitz | Opportunities |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  )

  for (const entry of inventory.entries) {
    lines.push(
      `| ${entry.repoDirName} | ${entry.packageName ?? '(unnamed)'} | ${entry.packageManager} | ${entry.workspaceKind} | ${entry.usesEffect ? 'yes' : 'no'} | ${entry.usesLegacyKit ? 'yes' : 'no'} | ${entry.currentKitzPackages.join(', ') || 'none'} | ${entry.opportunities.map(renderOpportunity).join('<br>') || 'none'} |`,
    )
  }

  return lines.join('\n')
}

export const scanFleet = (
  baseDir: string,
  options: DiscoverRepoDirectoriesOptions = {},
): FleetInventory => ({
  baseDir,
  entries: discoverRepoDirectories(baseDir, options).map(scanRepo),
})

export const defaultFleetBaseDir = (cwd: string): string => dirname(cwd)
