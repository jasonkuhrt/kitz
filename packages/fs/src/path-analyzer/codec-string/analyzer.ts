import type { Analyze } from './analyzer.types.js'

interface AnalysisBase {
  /** Original input string */
  original: string
}

interface AnalysisNonRoot extends AnalysisBase {
  /** Original input string */
  original: string
  pathType: 'absolute' | 'relative'
  isPathAbsolute: boolean
  isPathRelative: boolean
}

export type Analysis =
  | AnalysisFile
  | AnalysisDir

export interface AnalysisFile extends AnalysisNonRoot {
  _tag: 'file'
  /** Original input string */
  original: string
  /** Count of unresolved parent directory traversals (..) */
  back: number
  /** Path segments (excluding the filename). Never contains '..' - always normalized. */
  path: string[]
  /** File metadata */
  file: {
    stem: string
    extension: string | null
  }
}

export interface AnalysisDir extends AnalysisNonRoot {
  _tag: 'dir'
  /** Original input string */
  original: string
  /** Count of unresolved parent directory traversals (..) */
  back: number
  /** Path segments (including all directory names). Never contains '..' - always normalized. */
  path: string[]
}

// Path segment constants
export const separator = '/'
export const hereSegment = '.'
export const backSegment = '..'

// Derived prefix constants
export const herePrefix = `${hereSegment}${separator}` // './'
export const backPrefix = `${backSegment}${separator}` // '../'

/**
 * Analyze a location string to extract its components.
 *
 * @param input - The location string to analyze
 * @returns Analyzed location components
 *
 * @example
 * ```ts
 * analyze('/src/index.ts')   // { isAbsolute: true, isDirectory: false, filename: 'index.ts', ... }
 * analyze('./docs/')         // { isAbsolute: false, isDirectory: true, dirname: 'docs', ... }
 * analyze('/')               // { isAbsolute: true, isDirectory: true, dirname: undefined, ... }
 * analyze('../src/file.ts')  // { isAbsolute: false, parentRefs: 1, filename: 'file.ts', ... }
 * ```
 */

/**
 * Normalize segments by resolving '..' references.
 * Returns the final back count and clean segments.
 *
 * @param initialBack - Parent refs counted before segments (leading ../)
 * @param rawSegments - Raw segments that may contain '..'
 */
const normalizeWithBack = (
  initialBack: number,
  rawSegments: readonly string[],
): { back: number; segments: string[] } => {
  let back = initialBack
  const segments: string[] = []

  for (const segment of rawSegments) {
    if (segment === backSegment) {
      // Parent ref: either pop a segment or increment back
      if (segments.length > 0) {
        segments.pop()
      } else {
        back++
      }
    } else if (segment !== hereSegment && segment !== '') {
      segments.push(segment)
    }
  }

  return { back, segments }
}

/**
 * Optional hints to influence analyzer heuristics for ambiguous cases.
 *
 * The analyzer uses extension presence to distinguish files from directories,
 * but dotfiles like `.gitignore` are ambiguous. Hints allow explicit constructors
 * to express their intent for these edge cases.
 */
export interface AnalyzerOptions {
  /**
   * Hint for ambiguous cases (dotfiles without extensions).
   * - 'file': Treat ambiguous paths as files
   * - 'directory': Treat ambiguous paths as directories (default)
   */
  hint?: 'file' | 'directory'
}

export function analyze<const input extends string>(input: input, options?: AnalyzerOptions): Analyze<input> {
  return analyze_(input, options) as Analyze<input>
}

export function analyze_(input: string, options?: AnalyzerOptions): Analysis {
  const isAbsolute = input.startsWith(separator)

  // Handle root case as an absolute directory with empty path
  if (input === separator) {
    return {
      _tag: 'dir',
      pathType: 'absolute',
      isPathAbsolute: true,
      isPathRelative: false,
      back: 0,
      path: [],
      original: input,
    }
  }

  // Determine if it's a directory or file
  // 1. Trailing slash = directory
  // 2. Has extension = file
  // 3. Otherwise = directory
  let isDirectory: boolean

  if (
    input === '' || input === hereSegment || input === herePrefix || input === backSegment || input === backPrefix
    || input.endsWith(separator)
  ) {
    isDirectory = true
  } else {
    // Check if last segment has an extension
    const segments = input.split(separator).filter(s => s !== '')
    const lastSegment = segments[segments.length - 1]

    if (lastSegment) {
      // Has extension if there's a dot that's not at the beginning
      // .gitignore -> no extension (ambiguous - use hint or default to directory)
      // file.txt -> has extension (clearly a file)
      const dotIndex = lastSegment.lastIndexOf('.')
      const hasExtension = dotIndex > 0

      if (hasExtension) {
        // Clear extension = definitely a file
        isDirectory = false
      } else if (options?.hint) {
        // Ambiguous case: use hint from explicit constructor
        isDirectory = options.hint === 'directory'
      } else {
        // Ambiguous case: default to directory (conservative)
        isDirectory = true
      }
    } else {
      // No last segment, treat as directory
      isDirectory = true
    }
  }

  // Normalize the input for segment extraction
  let normalized = input
  let parentRefs = 0

  // Remove leading slash for absolute paths
  if (isAbsolute) {
    normalized = input.slice(separator.length)
  }

  // Count and remove parent directory references
  while (normalized.startsWith(backPrefix)) {
    parentRefs++
    normalized = normalized.slice(backPrefix.length)
  }

  // Handle current directory prefix
  if (normalized.startsWith(herePrefix)) {
    normalized = normalized.slice(herePrefix.length)
  }

  // Remove trailing slash for directories (except root)
  if (isDirectory && normalized.endsWith(separator)) {
    normalized = normalized.slice(0, -1)
  }

  // Extract all segments (may contain '..' for mid-path parent refs)
  const rawSegments = normalized
    ? normalized.split(separator).filter(s => s !== '')
    : []

  // Normalize: resolve all '..' references
  // For absolute paths, back is always 0 (can't go above root)
  const { back, segments: normalizedSegments } = normalizeWithBack(
    isAbsolute ? 0 : parentRefs,
    rawSegments,
  )
  // For absolute paths, discard any computed back (can't escape root)
  const finalBack = isAbsolute ? 0 : back

  const pathType: 'absolute' | 'relative' = isAbsolute ? 'absolute' : 'relative'
  const isPathAbsolute = isAbsolute
  const isPathRelative = !isAbsolute

  if (isDirectory) {
    // For directories, all segments are part of the path
    return {
      _tag: 'dir',
      pathType,
      isPathAbsolute,
      isPathRelative,
      back: finalBack,
      path: normalizedSegments,
      original: input,
    }
  }

  // For files, the last segment is the filename
  if (normalizedSegments.length === 0) {
    // Edge case: empty filename or only back refs
    return {
      _tag: 'file',
      pathType,
      isPathAbsolute,
      isPathRelative,
      back: finalBack,
      path: [],
      file: {
        stem: '',
        extension: null,
      },
      original: input,
    }
  }

  const path = normalizedSegments.slice(0, -1)
  // We know normalizedSegments is non-empty here (empty case handled above)
  const filename = normalizedSegments[normalizedSegments.length - 1]!

  // Extract extension
  const dotIndex = filename.lastIndexOf('.')
  const extension = dotIndex > 0 ? filename.substring(dotIndex) : null
  const stem = dotIndex > 0 ? filename.substring(0, dotIndex) : filename

  return {
    _tag: 'file',
    pathType,
    isPathAbsolute,
    isPathRelative,
    back: finalBack,
    path,
    file: {
      stem,
      extension,
    },
    original: input,
  }
}
