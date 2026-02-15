import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Schema as S } from 'effect'
import type { Package } from '../workspace.js'

/**
 * Schema for Package with string path transform.
 * Encoded: `{ scope: string, name: string, path: string }`
 * Decoded: `Package` (with path as AbsDir, name as Moniker)
 */
export const PackageSchema: S.Schema<Package, { scope: string; name: string; path: string }> = S.Struct({
  scope: S.String,
  name: Pkg.Moniker.FromString,
  path: Fs.Path.AbsDir.Schema,
})
