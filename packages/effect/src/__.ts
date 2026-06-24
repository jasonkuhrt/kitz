/**
 * Filesystem utilities that provide value-add functionality over Effect's FileSystem service.
 *
 * These utilities complement Effect's FileSystem by providing higher-level operations
 * commonly needed in build tools and CLI applications.
 *
 * ## Naming Convention
 *
 * This module follows Kit's namespace naming convention:
 * - **PascalCase** = Data/Types/Schemas (e.g., `Path.AbsFile`, `FileSystem.PathAnalyzer.Analysis`)
 * - **camelCase** = Operations - both term-level and type-level (e.g., `Path.up()`, `FileSystem.PathAnalyzer.analyze<T>`)
 *
 * This pattern applies recursively at all namespace levels.
 *
 * @module
 */
export * from './filesystem/filesystem.js'
export * from './filesystem/fs.js'
export { FileSystem } from './filesystem/service.js'
export * as Memory from './filesystem/layers/memory.js'
export { PathAnalyzer } from './path/path-analyzer/__.js'
