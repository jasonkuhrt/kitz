/**
 * Error types for @kitz/conf.
 *
 * Provides type-safe access to all error types via `Conf.Errors.<ErrorName>`.
 *
 * @module
 */

// File-based config errors
export type { InvalidExportError, NotFoundError } from './file/errors.js'

/**
 * Union of all errors from this package.
 *
 * @example
 * ```ts
 * import { Conf } from '@kitz/conf'
 *
 * type HandleError = (error: Conf.Errors.All) => void
 * ```
 */
export type All = import('./file/errors.js').NotFoundError | import('./file/errors.js').InvalidExportError
