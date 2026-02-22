import { Fs } from '@kitz/fs'

/**
 * Path to the .gitignore file relative to repository root.
 *
 * @remarks
 * Dotfiles without extensions need explicit `RelFile` construction
 * since the path analyzer can't distinguish them from directories.
 */
export const GITIGNORE = Fs.Path.RelFile.fromString('./.gitignore')

/**
 * Path to the .gitattributes file relative to repository root.
 */
export const GITATTRIBUTES = Fs.Path.RelFile.fromString('./.gitattributes')
