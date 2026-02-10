import { Ts } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Option, Schema as S } from 'effect'
import * as Moniker from '../moniker/moniker.js'

const Author = S.Struct({
  name: S.optional(S.String),
  email: S.optional(S.String),
  url: S.optional(S.String),
})

const Repository = S.Struct({
  type: S.optional(S.String),
  url: S.optional(S.String),
})

const Bugs = S.Struct({
  url: S.optional(S.String),
  email: S.optional(S.String),
})

const Engines = S.Struct({
  node: S.optional(S.String),
  npm: S.optional(S.String),
  pnpm: S.optional(S.String),
})

const Workspaces = S.Struct({
  packages: S.optional(S.Array(S.String)),
  nohoist: S.optional(S.Array(S.String)),
})

/**
 * Class schema for package.json manifest
 */
export class Manifest extends S.Class<Manifest>('Manifest')({
  name: S.optionalWith(Moniker.FromString, { default: () => new Moniker.Unscoped({ name: 'unnamed' }) }),
  version: S.optionalWith(Semver.Schema, { default: () => Semver.zero }),
  description: S.optional(S.String),
  main: S.optional(S.String),
  type: S.optional(S.Literal('module', 'commonjs')),
  scripts: S.optional(S.Record({ key: S.String, value: S.String })),
  dependencies: S.optional(S.Record({ key: S.String, value: S.String })),
  devDependencies: S.optional(S.Record({ key: S.String, value: S.String })),
  peerDependencies: S.optional(S.Record({ key: S.String, value: S.String })),
  optionalDependencies: S.optional(S.Record({ key: S.String, value: S.String })),
  bin: S.optional(S.Union(
    S.String,
    S.Record({ key: S.String, value: S.String }),
  )),
  files: S.optional(S.Array(S.String)),
  exports: S.optional(S.Union(
    S.Record({ key: S.String, value: S.Unknown }),
    S.String,
  )),
  imports: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  engines: S.optional(Engines),
  repository: S.optional(S.Union(
    Repository,
    S.String,
  )),
  keywords: S.optional(S.Array(S.String)),
  author: S.optional(S.Union(
    S.String,
    Author,
  )),
  license: S.optional(S.String),
  bugs: S.optional(S.Union(
    Bugs,
    S.String,
  )),
  homepage: S.optional(S.String),
  private: S.optional(S.Boolean),
  workspaces: S.optional(S.Union(
    S.Array(S.String),
    Workspaces,
  )),
  packageManager: S.optional(S.String),
  madge: S.optional(S.Unknown),
}) {
  /**
   * Create a mutable copy of this manifest.
   * Useful when you need to perform multiple mutations efficiently.
   */
  toMutable(): ManifestMutable {
    return S.decodeUnknownSync(ManifestSchemaMutable)(this) as ManifestMutable
  }
}

/**
 * Mutable version of the manifest schema for runtime manipulation
 */
export const ManifestSchemaMutable = S.mutable(Manifest)

export const ManifestSchemaImmutable = Manifest

/**
 * Mutable type for runtime manipulation
 */
export type ManifestMutable = Ts.WritableDeep<Manifest>

/**
 * Type for bin property when normalized
 */
export type PropertyBinNormalized = Record<string, string>

/**
 * Type for package exports
 */
export type PropertyExports = Record<string, unknown> | string

/**
 * Create a new Manifest with validation and defaults
 * @deprecated Use Manifest.create() or Manifest.make() instead
 */
export const make = Manifest.make.bind(Manifest)

/**
 * Empty manifest with minimal required fields
 */
export const emptyManifest = Manifest.make()

/**
 * Resource for reading/writing package.json with Schema validation.
 *
 * Uses `preserveExcessProperties: true` to ensure unknown fields in package.json
 * (like `turbo`, `publishConfig`, custom fields) survive round-trips.
 */
export const resource: Resource.Resource<Manifest> = Resource.createJson(
  'package.json',
  Manifest,
  emptyManifest,
  { preserveExcessProperties: true },
)

/**
 * Mutable resource for backward compatibility
 * @deprecated Use resource instead and call toMutable() on the result if needed
 */
export const resourceMutable: Resource.Resource<ManifestMutable> = {
  read: (path: Fs.Path.$Abs) =>
    resource.read(path).pipe(
      Effect.map(Option.map((m) => m.toMutable())),
    ),
  readRequired: (path: Fs.Path.$Abs) =>
    resource.readRequired(path).pipe(
      Effect.map((m) => m.toMutable()),
    ),
  write: (value: ManifestMutable, path: Fs.Path.$Abs) => resource.write(Manifest.make(value), path),
  readOrEmpty: (path: Fs.Path.$Abs) =>
    resource.readOrEmpty(path).pipe(
      Effect.map((m) => m.toMutable()),
    ),
  update: (path: Fs.Path.$Abs, fn: (current: ManifestMutable) => ManifestMutable) =>
    resource.update(path, (m) => Manifest.make(fn(m.toMutable()))).pipe(
      Effect.map((m) => m.toMutable()),
    ),
  delete: (path: Fs.Path.$Abs) => resource.delete(path),
}

/**
 * Overwrite a package script (mutates the manifest).
 */
export const overwritePackageScript = (manifest: ManifestMutable, scriptName: string, script: string): void => {
  if (!manifest.scripts) {
    manifest.scripts = {}
  }
  manifest.scripts[scriptName] = script
}

/**
 * Merge a script into an existing package script (mutates the manifest).
 */
export const mergePackageScript = (manifest: ManifestMutable, scriptName: string, script: string): void => {
  if (!manifest.scripts) {
    manifest.scripts = {}
  }
  const existing = manifest.scripts[scriptName]
  if (existing && !existing.includes(script)) {
    manifest.scripts[scriptName] = `${existing} && ${script}`
  } else if (!existing) {
    manifest.scripts[scriptName] = script
  }
}

/**
 * Remove a package script or part of a script (mutates the manifest).
 */
export const removePackageScript = (manifest: ManifestMutable, scriptName: string, scriptPart?: string): void => {
  if (!manifest.scripts || !manifest.scripts[scriptName]) {
    return
  }

  if (!scriptPart) {
    delete manifest.scripts[scriptName]
  } else {
    const current = manifest.scripts[scriptName]
    if (current.includes(` && ${scriptPart}`)) {
      manifest.scripts[scriptName] = current.replace(` && ${scriptPart}`, '')
    } else if (current.includes(`${scriptPart} && `)) {
      manifest.scripts[scriptName] = current.replace(`${scriptPart} && `, '')
    } else if (current === scriptPart) {
      delete manifest.scripts[scriptName]
    }
  }
}

/**
 * Parse package name moniker (org/name format).
 */
export const parseMoniker = (packageName: string): { org?: string; name: string } => {
  const parts = packageName.split('/')
  if (parts.length === 2 && parts[0]?.startsWith('@')) {
    return { org: parts[0], name: parts[1]! }
  }
  return { name: packageName }
}
