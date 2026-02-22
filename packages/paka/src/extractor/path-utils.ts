/**
 * Path transformation utilities for converting between build and source paths.
 *
 * The paka extractor works with both build artifacts (JS) and source files (TS).
 * These utilities handle the conversions between these different path formats.
 */

import { relative } from 'path'

/**
 * Create a build path to source path transformer.
 *
 * Behavior depends on whether TypeScript configuration is provided:
 * - **With tsconfig** (outDir/rootDir defined): Transforms directory AND extension
 * - **Without tsconfig**: Only transforms extension (.js → .ts)
 *
 * This allows tests to point package.json directly to source files (no directory
 * transformation needed), while real builds can use tsconfig to map build artifacts
 * to their source locations.
 *
 * @param config - Optional compiler options from tsconfig
 * @returns Transformer function that converts build paths to source paths
 *
 * @example
 * // With tsconfig (outDir/rootDir defined) - full transformation
 * const transformer = createBuildToSourcePath({
 *   outDir: '/project/build',
 *   rootDir: '/project/src',
 *   projectRoot: '/project'
 * })
 * transformer('./build/arr/__.js')
 * // => './src/arr/__.ts'
 *
 * @example
 * // Without tsconfig - only extension transformation
 * const transformer = createBuildToSourcePath()
 * transformer('./src/arr/__.js')
 * // => './src/arr/__.ts'
 */
export const createBuildToSourcePath = (config?: {
  /** Absolute path to build output directory from tsconfig */
  outDir: string
  /** Absolute path to source root directory from tsconfig */
  rootDir: string
  /** Project root directory (for making paths relative) */
  projectRoot: string
}) => {
  // If config provided, do directory transformation
  if (config?.outDir && config?.rootDir) {
    // Convert absolute paths to relative (with ./ prefix)
    const buildDirRel = './' + relative(config.projectRoot, config.outDir)
    const sourceDirRel = './' + relative(config.projectRoot, config.rootDir)

    return (buildPath: string): string => {
      return buildPath
        .replace(buildDirRel, sourceDirRel)
        .replace(/\.js$/, '.ts')
    }
  }

  // No config - only transform extension
  return (buildPath: string): string => {
    return buildPath.replace(/\.js$/, '.ts')
  }
}

/**
 * Convert an absolute file path to a relative path from project root.
 *
 * Handles both real filesystem paths (with cwd prefix) and virtual
 * in-memory filesystem paths (starting with /).
 *
 * @example
 * // Real filesystem
 * absoluteToRelative('/Users/foo/project/src/index.ts')
 * // => 'src/index.ts' (if cwd is /Users/foo/project)
 *
 * @example
 * // Virtual filesystem (in-memory ts-morph)
 * absoluteToRelative('/src/index.ts')
 * // => 'src/index.ts'
 */
export const absoluteToRelative = (absolutePath: string): string => {
  // Try to make it relative to cwd (for real filesystem)
  const relative = absolutePath.replace(process.cwd() + '/', '')
  if (relative !== absolutePath) {
    // Successfully made relative to cwd
    return relative
  }
  // If that didn't work, assume it's a virtual absolute path (starts with /)
  // Strip leading / to make it relative
  if (absolutePath.startsWith('/')) {
    return absolutePath.slice(1)
  }
  return absolutePath
}
