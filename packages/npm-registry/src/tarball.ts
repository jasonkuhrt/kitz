/**
 * Tarball naming for packed npm packages.
 *
 * npm-compatible package managers derive a pack tarball's filename from the
 * package name and version: the scoped name is slugified
 * (`@scope/name` → `scope-name`) and joined with the version as
 * `<slug>-<version>.tgz`. This module is the single authority for that
 * derivation.
 */

import { Fs } from '@kitz/fs'

/**
 * Slugify a package name the way `npm pack` does for tarball filenames.
 *
 * Strips the leading `@` and replaces `/` with `-`.
 *
 * @example
 * ```ts
 * Tarball.slugifyPackageName('@kitz/core') // 'kitz-core'
 * Tarball.slugifyPackageName('react')      // 'react'
 * ```
 */
export const slugifyPackageName = (packageName: string): string =>
  packageName.replace(/^@/u, '').replace(/\//gu, '-')

/**
 * The tarball filename `npm pack` produces for a package version:
 * `<slug>-<version>.tgz`.
 *
 * @example
 * ```ts
 * Tarball.filename('@kitz/core', '1.2.0') // 'kitz-core-1.2.0.tgz'
 * ```
 */
export const filename = (packageName: string, version: string): string =>
  `${slugifyPackageName(packageName)}-${version}.tgz`

/**
 * Absolute tarball path for a package version inside a pack destination
 * directory.
 *
 * @example
 * ```ts
 * Tarball.path(Fs.Path.AbsDir.fromString('/repo/.release/artifacts/'), '@kitz/core', '1.2.0')
 * // AbsFile '/repo/.release/artifacts/kitz-core-1.2.0.tgz'
 * ```
 */
export const path = (
  packDestination: Fs.Path.AbsDir,
  packageName: string,
  version: string,
): Fs.Path.AbsFile =>
  Fs.Path.join(packDestination, Fs.Path.RelFile.fromString(`./${filename(packageName, version)}`))
