/**
 * Error types for @kitz/mod.
 *
 * Provides type-safe access to all error types via `Mod.Errors.<ErrorName>`.
 *
 * @module
 */
export type {
  ImportError,
  ImportErrorNotFound,
  ImportErrorOther,
  ImportErrorPackageConfig,
  ImportErrorPermissionDenied,
  ImportErrorSyntax,
  ImportErrorUnsupportedFormat,
} from './import.js'

/**
 * Union of all errors from this package.
 *
 * @example
 * ```ts
 * import { Mod } from '@kitz/mod'
 *
 * type HandleError = (error: Mod.Errors.All) => void
 * ```
 */
export type { ImportError as All } from './import.js'
