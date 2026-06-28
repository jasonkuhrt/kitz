import { flow, Option, Result, SchemaIssue } from 'effect'

// Path segment constants (internal — the codecs go through analyze/format)
const separator = '/'
const hereSegment = '.'
const backSegment = '..'
const herePrefix = `${hereSegment}${separator}` // './'
const backPrefix = `${backSegment}${separator}` // '../'

/** A path string analyzed into its kind, absoluteness, parent-traversal count, and named segments. */
export type Analysis = AnalysisFile | AnalysisDir

export interface AnalysisFile {
  _tag: 'file'
  isPathAbsolute: boolean
  /** Parent-traversal count (leading `..`); always 0 for absolute paths. */
  back: number
  /** Named path segments (no `..`), excluding the filename. */
  segments: string[]
  /** The filename (last path component) as a string; the `FileName` codec owns its stem/extension split. */
  fileName: string
}

export interface AnalysisDir {
  _tag: 'dir'
  isPathAbsolute: boolean
  /** Parent-traversal count (leading `..`); always 0 for absolute paths. */
  back: number
  /** Named path segments (no `..`). */
  segments: string[]
}

/** The schema issue for a path that didn't match the expected kind or absoluteness. */
const invalid = (input: string, expected: string): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(input), {
    message: `Expected ${expected}, received ${JSON.stringify(input)}`,
  })

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
 * analyze('/src/index.ts')   // { _tag: 'file', isPathAbsolute: true, segments: ['src'], fileName: 'index.ts' }
 * analyze('../docs/')        // { _tag: 'dir', isPathAbsolute: false, segments: ['..', 'docs'] }
 * ```
 */
export function analyze(input: string, options?: AnalyzerOptions): Analysis {
  const isAbsolute = input.startsWith(separator)

  // Root: an absolute directory with no segments.
  if (input === separator) {
    return { _tag: 'dir', isPathAbsolute: true, back: 0, segments: [] }
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
      back: finalBack,
      segments: normalizedSegments,
    }
  }
  if (normalizedSegments.length === 0) {
    return { _tag: 'file', isPathAbsolute: isAbsolute, back: finalBack, segments: [], fileName: '' }
  }

  return {
    _tag: 'file',
    isPathAbsolute: isAbsolute,
    back: finalBack,
    segments: normalizedSegments.slice(0, -1),
    fileName: normalizedSegments[normalizedSegments.length - 1]!,
  }
}

/**
 * The core curried validator: parse `input`, narrow it to `kind`, and require the
 * given absoluteness. Every public path analyzer is a partial application of this.
 */
const analyzeAs =
  <K extends Analysis['_tag']>(kind: K) =>
  (options: { absolute: boolean }) =>
  (input: string): Result.Result<Extract<Analysis, { _tag: K }>, SchemaIssue.Issue> => {
    const analysis = analyze(input, { hint: kind === 'dir' ? 'directory' : 'file' })
    return analysis._tag !== kind
      ? Result.fail(invalid(input, kind === 'dir' ? 'a directory path' : 'a file path'))
      : analysis.isPathAbsolute !== options.absolute
        ? Result.fail(invalid(input, options.absolute ? 'an absolute path' : 'a relative path'))
        : Result.succeed(analysis as Extract<Analysis, { _tag: K }>)
  }

/** Require a file of the given absoluteness. */
export const analyzeFile = analyzeAs('file')

/** Require a directory of the given absoluteness. */
export const analyzeDir = analyzeAs('dir')

/** Split a filename into stem + extension (a leading dot is part of the stem). */
const splitExtension = (fileName: string): { stem: string; extension: string | null } => {
  const dotIndex = fileName.lastIndexOf('.')
  return {
    stem: dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName,
    extension: dotIndex > 0 ? fileName.substring(dotIndex) : null,
  }
}

/** Issue raised when a filename input is actually a path (has segments). */
const notABareFilename = new SchemaIssue.InvalidValue(Option.none(), {
  message: 'Expected a bare filename, not a path',
})

/** A bare filename (a relative, segment-less file) parsed into stem + extension. */
export const analyzeFileName = flow(
  analyzeFile({ absolute: false }),
  Result.flatMap((analysis) =>
    analysis.segments.length > 0
      ? Result.fail(notABareFilename)
      : Result.succeed(splitExtension(analysis.fileName)),
  ),
)

/**
 * Build a path string — the inverse of {@link analyze}. Curried: fix the path shape
 * (absoluteness, `back`, optional `fileName`), then apply the segments.
 *
 * `fileName` present → a file path; absent → a directory path (trailing `/`).
 * Relative paths get one leading `../` per `back` step, or `./` when `back` is 0.
 */
export const format =
  (parts: { isPathAbsolute: boolean; back: number; fileName?: string | null }) =>
  (segments: readonly string[]): string => {
    const body = segments.join(separator)
    const file = parts.fileName ?? null

    if (parts.isPathAbsolute) {
      if (file !== null)
        return body ? `${separator}${body}${separator}${file}` : `${separator}${file}`
      return body ? `${separator}${body}${separator}` : separator
    }

    // One `../` per back step, else `./`.
    const prefix = parts.back > 0 ? backPrefix.repeat(parts.back) : herePrefix
    if (file !== null) return body ? `${prefix}${body}${separator}${file}` : `${prefix}${file}`
    return body ? `${prefix}${body}${separator}` : prefix
  }
