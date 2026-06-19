/**
 * Filesystem utilities that provide value-add functionality over Effect's FileSystem service.
 *
 * These utilities complement Effect's FileSystem by providing higher-level operations
 * commonly needed in build tools and CLI applications.
 *
 * ## Naming Convention
 *
 * This module follows Kit's namespace naming convention:
 * - **PascalCase** = Data/Types/Schemas (e.g., `Fs.Path.AbsFile`, `Fs.PathAnalyzer.Analysis`)
 * - **camelCase** = Operations - both term-level and type-level (e.g., `Fs.Path.up()`, `Fs.PathAnalyzer.analyze<T>`)
 *
 * This pattern applies recursively at all namespace levels.
 *
 * @module
 */
export * as Builder from './builder/__.js'
export * from './filesystem.js'
export * from './fs.js'
export * from './glob.js'
export * as Memory from './memory/__.js'
export { PathAnalyzer } from './path-analyzer/__.js'
