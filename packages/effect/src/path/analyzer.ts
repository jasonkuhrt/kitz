// Path segment constants (internal — the codecs go through analyze/format)
const separator = '/'
const hereSegment = '.'
const backSegment = '..'
const herePrefix = `${hereSegment}${separator}` // './'
const backPrefix = `${backSegment}${separator}` // '../'

/** A path string analyzed into its kind, absoluteness, and folded segments. */
export type Analysis = AnalysisFile | AnalysisDir

export interface AnalysisFile {
  _tag: 'file'
  isPathAbsolute: boolean
  /** Folded path segments (leading `..` steps), excluding the filename. */
  segments: string[]
  file: { stem: string; extension: string | null }
}

export interface AnalysisDir {
  _tag: 'dir'
  isPathAbsolute: boolean
  /** Folded path segments (leading `..` steps). */
  segments: string[]
}

/**
 * Normalize segments by resolving '..' references.
 * Returns the final back count and clean segments.
 */
const normalizeWithBack = (
  initialBack: number,
  rawSegments: readonly string[],
): { back: number; segments: string[] } => {
  let back = initialBack
  const segments: string[] = []

  for (const segment of rawSegments) {
    if (segment === backSegment) {
      if (segments.length > 0) segments.pop()
      else back++
    } else if (segment !== hereSegment && segment !== '') {
      segments.push(segment)
    }
  }

  return { back, segments }
}

/** Fold a back count and named segments into one segment list with leading `..` steps. */
const fold = (back: number, segments: readonly string[]): string[] => [
  ...Array.from({ length: back }, () => backSegment),
  ...segments,
]

/**
 * Optional hints to influence analyzer heuristics for ambiguous cases.
 *
 * The analyzer uses extension presence to distinguish files from directories,
 * but dotfiles like `.gitignore` are ambiguous. Hints let explicit constructors
 * express their intent for these edge cases.
 */
export interface AnalyzerOptions {
  /** 'file' / 'directory' (default) resolution for ambiguous dotfiles. */
  hint?: 'file' | 'directory'
}

/**
 * Parse a path string into its kind, absoluteness, and folded segments.
 *
 * @example
 * ```ts
 * analyze('/src/index.ts')   // { _tag: 'file', isPathAbsolute: true, segments: ['src'], file: { stem: 'index', extension: '.ts' } }
 * analyze('../docs/')        // { _tag: 'dir', isPathAbsolute: false, segments: ['..', 'docs'] }
 * ```
 */
export function analyze(input: string, options?: AnalyzerOptions): Analysis {
  const isAbsolute = input.startsWith(separator)

  // Root: an absolute directory with no segments.
  if (input === separator) {
    return { _tag: 'dir', isPathAbsolute: true, segments: [] }
  }

  // Directory iff: trailing slash, a bare here/back reference, or no extension on the last segment.
  let isDirectory: boolean
  if (
    input === '' ||
    input === hereSegment ||
    input === herePrefix ||
    input === backSegment ||
    input === backPrefix ||
    input.endsWith(separator)
  ) {
    isDirectory = true
  } else {
    const segments = input.split(separator).filter((s) => s !== '')
    const lastSegment = segments[segments.length - 1]
    if (lastSegment) {
      // A dot that's not at index 0 marks an extension (`.gitignore` is ambiguous → hint/default).
      const hasExtension = lastSegment.lastIndexOf('.') > 0
      isDirectory = hasExtension ? false : options?.hint ? options.hint === 'directory' : true
    } else {
      isDirectory = true
    }
  }

  // Strip the leading slash / `../` / `./` markers, count parent refs.
  let normalized = isAbsolute ? input.slice(separator.length) : input
  let parentRefs = 0
  while (normalized.startsWith(backPrefix)) {
    parentRefs++
    normalized = normalized.slice(backPrefix.length)
  }
  if (normalized.startsWith(herePrefix)) normalized = normalized.slice(herePrefix.length)
  if (isDirectory && normalized.endsWith(separator)) normalized = normalized.slice(0, -1)

  const rawSegments = normalized ? normalized.split(separator).filter((s) => s !== '') : []
  // Absolute paths can't escape root, so their back count is always 0.
  const { back, segments: normalizedSegments } = normalizeWithBack(
    isAbsolute ? 0 : parentRefs,
    rawSegments,
  )
  const finalBack = isAbsolute ? 0 : back

  if (isDirectory) {
    return {
      _tag: 'dir',
      isPathAbsolute: isAbsolute,
      segments: fold(finalBack, normalizedSegments),
    }
  }
  if (normalizedSegments.length === 0) {
    return {
      _tag: 'file',
      isPathAbsolute: isAbsolute,
      segments: fold(finalBack, []),
      file: { stem: '', extension: null },
    }
  }

  const path = normalizedSegments.slice(0, -1)
  const filename = normalizedSegments[normalizedSegments.length - 1]!
  const dotIndex = filename.lastIndexOf('.')
  const extension = dotIndex > 0 ? filename.substring(dotIndex) : null
  const stem = dotIndex > 0 ? filename.substring(0, dotIndex) : filename

  return {
    _tag: 'file',
    isPathAbsolute: isAbsolute,
    segments: fold(finalBack, path),
    file: { stem, extension },
  }
}

/**
 * Build a path string from its parts — the inverse of {@link analyze}.
 *
 * `fileName` present → a file path; absent → a directory path (trailing `/`).
 * Relative paths get a `./` prefix unless they already lead with `..`.
 */
export const format = (parts: {
  isPathAbsolute: boolean
  segments: readonly string[]
  fileName?: { stem: string; extension: string | null } | null
}): string => {
  const body = parts.segments.join(separator)
  const file = parts.fileName
    ? parts.fileName.extension
      ? `${parts.fileName.stem}${parts.fileName.extension}`
      : parts.fileName.stem
    : null

  if (parts.isPathAbsolute) {
    if (file !== null)
      return body ? `${separator}${body}${separator}${file}` : `${separator}${file}`
    return body ? `${separator}${body}${separator}` : separator
  }

  const prefix = parts.segments[0] === backSegment ? '' : herePrefix
  if (file !== null) return body ? `${prefix}${body}${separator}${file}` : `${herePrefix}${file}`
  return body ? `${prefix}${body}${separator}` : herePrefix
}
