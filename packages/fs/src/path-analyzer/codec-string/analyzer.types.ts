import { Str } from '@kitz/core'
import type { Analysis } from './analyzer.js'

/**
 * Type-level analyzer for path strings.
 * Mirrors the runtime analyzer logic for compile-time path analysis.
 */

const PATH_SEPARATOR = '/'
type PATH_SEPARATOR = typeof PATH_SEPARATOR

// ============================================================================
// Extension detection
// ============================================================================

/**
 * Check if a segment has a valid extension.
 * Rules matching runtime:
 * - lastIndexOf('.') > 0 means has extension
 * - .gitignore -> no extension (lastIndexOf = 0)
 * - .env.local -> has extension (lastIndexOf = 4)
 * - file.txt -> has extension (lastIndexOf = 4)
 */
type HasExtension<$segment extends string> =
  // Check for files starting with dot that have another dot
  $segment extends `.${infer __rest__}`
    ? __rest__ extends `${string}.${string}`
      ? true // .env.local has extension
      : false // .gitignore has no extension
    : // Normal files - any dot means extension
      $segment extends `${string}.${string}`
      ? true
      : false

/**
 * Simple approach: take everything after last dot as extension.
 * For simplicity, we'll just handle common cases.
 */
type ExtractExtension<$segment extends string> =
  // Handle files starting with dot
  $segment extends `.${infer __rest__}`
    ? __rest__ extends `${string}.${infer __ext__}`
      ? `.${__ext__}` // .env.local -> .local
      : null // .gitignore -> null
    : // Handle normal files
      $segment extends `${string}.${infer __ext__}`
      ? `.${__ext__}` // file.txt -> .txt, file.test.ts -> .ts
      : null

/**
 * Extract the stem (name without extension) from a filename.
 */
type ExtractName<$segment extends string> =
  // Handle files starting with dot
  $segment extends `.${infer __rest__}`
    ? __rest__ extends `${infer __name__}.${string}`
      ? `.${__name__}` // .env.local -> .env
      : $segment // .gitignore -> .gitignore
    : // Handle normal files - need to get everything before last dot
      $segment extends `${infer __name__}.${string}`
      ? __name__ // This will get "file" from "file.txt" or "file.test" from "file.test.ts"
      : $segment

// ============================================================================
// Directory detection
// ============================================================================

/**
 * Check if a path string represents a directory.
 * Rules (matching runtime analyzer):
 * 1. Trailing slash = directory
 * 2. Special cases: '.', './', '..', '../' = directory
 * 3. Has extension = file
 * 4. Otherwise = directory
 */
type IsDirectory<$path extends string> = $path extends ''
  ? true
  : $path extends '.'
    ? true
    : $path extends './'
      ? true
      : $path extends '..'
        ? true
        : $path extends '../'
          ? true
          : Str.EndsWith<$path, PATH_SEPARATOR> extends true
            ? true
            : HasExtension<Str.LastSegment<Str.RemoveTrailingSlash<$path>>> extends true
              ? false
              : true // No extension = directory

// ============================================================================
// Path type detection
// ============================================================================

type IsAbsolute<$path extends string> =
  Str.StartsWith<$path, PATH_SEPARATOR> extends true ? true : false

type IsRelative<$path extends string> = IsAbsolute<$path> extends true ? false : true

// ============================================================================
// Path parsing
// ============================================================================

/**
 * Extract path segments (excluding filename for files).
 */
type ExtractPathSegments<$path extends string> =
  IsDirectory<$path> extends true
    ? Str.Split<Str.RemoveTrailingSlash<$path>, PATH_SEPARATOR>
    : $path extends `${infer __dir__}${PATH_SEPARATOR}${infer __file__}`
      ? Str.Split<__dir__, PATH_SEPARATOR>
      : []

// ============================================================================
// Main Analysis types
// ============================================================================

/**
 * File analysis result matching runtime AnalysisFile.
 * Note: `back` is typed as `number` for simplicity. Full type-level normalization
 * is a potential future enhancement.
 */
export type AnalysisFile<$path extends string = string> = {
  _tag: 'file'
  original: $path
  pathType: IsAbsolute<$path> extends true ? 'absolute' : 'relative'
  isPathAbsolute: IsAbsolute<$path>
  isPathRelative: IsRelative<$path>
  back: number
  path: ExtractPathSegments<$path>
  file: {
    stem: ExtractName<Str.LastSegment<$path>>
    extension: ExtractExtension<Str.LastSegment<$path>>
  }
}

/**
 * Directory analysis result matching runtime AnalysisDir.
 * Note: `back` is typed as `number` for simplicity. Full type-level normalization
 * is a potential future enhancement.
 */
export type AnalysisDir<$path extends string = string> = {
  _tag: 'dir'
  original: $path
  pathType: IsAbsolute<$path> extends true ? 'absolute' : 'relative'
  isPathAbsolute: IsAbsolute<$path>
  isPathRelative: IsRelative<$path>
  back: number
  path: ExtractPathSegments<$path>
}

/**
 * Type-level analyzer that mirrors runtime analyzeEncodedLocation.
 * Determines if a path is a file or directory and extracts metadata.
 * Falls back to Analysis union when given non-literal string type.
 */
export type Analyze<$path extends string> = string extends $path
  ? Analysis // Non-literal string fallback
  : IsDirectory<$path> extends true
    ? AnalysisDir<$path>
    : AnalysisFile<$path>

// ============================================================================
// Utility type exports
// ============================================================================

/**
 * Extract just the tag from analysis result.
 */
export type AnalyzeTag<$path extends string> = Analyze<$path>['_tag']

/**
 * Check if path would be analyzed as a file.
 */
export type IsFile<$path extends string> = AnalyzeTag<$path> extends 'file' ? true : false

/**
 * Check if path would be analyzed as a directory.
 */
export type IsDir<$path extends string> = AnalyzeTag<$path> extends 'dir' ? true : false
