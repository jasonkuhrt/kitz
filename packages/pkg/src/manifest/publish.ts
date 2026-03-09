import { Semver } from '@kitz/semver'
import { Pin } from '#pin'
import { rewriteRuntimeTargetsToBuild } from './runtime-targets.js'

const dependencyFieldNames = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

type DependencyFieldName = (typeof dependencyFieldNames)[number]
type JsonRecord = Record<string, unknown>

interface RewriteDependencyOptions {
  readonly workspaceVersions: Readonly<Record<string, Semver.Semver>>
}

export interface RewriteManifestForPackOptions extends RewriteDependencyOptions {
  readonly version: Semver.Semver
}

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const rewriteDependencyField = (field: unknown, options: RewriteDependencyOptions): unknown => {
  if (!isJsonRecord(field)) return field

  return Object.fromEntries(
    Object.entries(field).map(([dependencyName, specifier]) => {
      if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) {
        return [dependencyName, specifier]
      }

      const version = options.workspaceVersions[dependencyName]
      if (version === undefined) {
        return [dependencyName, specifier]
      }

      const pin = Pin.fromString(`${dependencyName}@${specifier}`)
      if (!Pin.Workspace.is(pin)) {
        return [dependencyName, specifier]
      }

      return [dependencyName, Pin.workspaceSpecifierToPublished(dependencyName, specifier, version)]
    }),
  )
}

/**
 * Rewrites a raw package.json object into the shape that should be packed for
 * publish while leaving source-first manifests intact in the repo.
 */
export const rewriteManifestForPack = (
  manifest: JsonRecord,
  options: RewriteManifestForPackOptions,
): JsonRecord => {
  const nextManifest: JsonRecord = {
    ...manifest,
    version: Semver.toString(options.version),
  }

  if (isJsonRecord(manifest['imports'])) {
    nextManifest['imports'] = rewriteRuntimeTargetsToBuild(manifest['imports'])
  }

  if (typeof manifest['exports'] === 'string') {
    nextManifest['exports'] = rewriteRuntimeTargetsToBuild(manifest['exports'])
  } else if (isJsonRecord(manifest['exports'])) {
    nextManifest['exports'] = rewriteRuntimeTargetsToBuild(manifest['exports'])
  }

  for (const fieldName of dependencyFieldNames) {
    nextManifest[fieldName] = rewriteDependencyField(manifest[fieldName], options)
  }

  return nextManifest
}

/**
 * Find publish-time lifecycle hooks that `npm pack` will run while preparing
 * an artifact.
 */
export const findPackHooks = (scripts: Record<string, string> | undefined): readonly string[] => {
  if (scripts === undefined) return []
  return ['prepack', 'prepare', 'postpack'].filter((name) => name in scripts)
}

/**
 * Find local package dependencies referenced by this manifest across all
 * dependency sections.
 */
export const findLocalDependencyNames = (
  manifest: {
    readonly dependencies?: Readonly<Record<string, string>> | undefined
    readonly devDependencies?: Readonly<Record<string, string>> | undefined
    readonly peerDependencies?: Readonly<Record<string, string>> | undefined
    readonly optionalDependencies?: Readonly<Record<string, string>> | undefined
  },
  localPackageNames: readonly string[],
): readonly string[] => {
  const names: string[] = []

  for (const fieldName of dependencyFieldNames) {
    const field = manifest[fieldName]
    if (field === undefined) continue

    for (const dependencyName of Object.keys(field)) {
      if (localPackageNames.includes(dependencyName) && !names.includes(dependencyName)) {
        names.push(dependencyName)
      }
    }
  }

  return names
}

export type DependencyField = DependencyFieldName
