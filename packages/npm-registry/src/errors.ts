import type { NpmCliError } from './cli.js'
import type { NpmRegistryError, SemverParseError } from './npm-registry.js'

export { NpmCliError } from './cli.js'
export { NpmRegistryError, SemverParseError } from './npm-registry.js'

/** Union of all errors from this package */
export type All = NpmCliError | NpmRegistryError | SemverParseError
