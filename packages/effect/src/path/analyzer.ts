import { Data, flow, Option, Result, SchemaIssue } from 'effect'
import {
  ascent as ascentSegment,
  ascentPrefix,
  here,
  herePrefix,
  nullByte,
  separator,
} from './core/grammar.js'
import { emptyPathMessage, targetDescription } from './core/messages.js'

/** A path string analyzed into its kind, absoluteness, parent-traversal count, and named segments. */
export type Analysis = Data.TaggedEnum<{
  file: {
    readonly isPathAbsolute: boolean
    /** Parent-traversal count (leading `..`); always 0 for absolute paths. */
    readonly ascent: number
    /** Named path segments (no `..`), excluding the filename. */
    readonly segments: ReadonlyArray<string>
    /** The filename (last path component) as a string; the `FileName` codec owns its stem/extension split. */
    readonly fileName: string
  }
  dir: {
    readonly isPathAbsolute: boolean
    /** Parent-traversal count (leading `..`); always 0 for absolute paths. */
    readonly ascent: number
    /** Named path segments (no `..`). */
    readonly segments: ReadonlyArray<string>
  }
}>

/** Constructors and matchers for {@link Analysis} (`Analysis.file`, `Analysis.dir`, `$is`, `$match`). */
export const Analysis = Data.taggedEnum<Analysis>()

/** A path analysis narrowed to files. */
export type AnalysisFile = Data.TaggedEnum.Value<Analysis, 'file'>

/** A path analysis narrowed to directories. */
export type AnalysisDir = Data.TaggedEnum.Value<Analysis, 'dir'>

/** The schema issue for a path that didn't match the expected kind or absoluteness. */
const invalid = (input: string, expected: string): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(Option.some(input), {
    message: `Expected ${expected}, received ${JSON.stringify(input)}`,
  })

const emptyPath = new SchemaIssue.InvalidValue(Option.some(''), {
  message: emptyPathMessage,
})

/**
 * Normalize segments by resolving '..' references.
 * Returns the final ascent count and clean segments.
 */
const normalizeWithAscent = (
  initialAscent: number,
  rawSegments: readonly string[],
): { ascent: number; segments: string[] } => {
  let ascent = initialAscent
  const segments: string[] = []

  for (const segment of rawSegments) {
    if (segment === ascentSegment) {
      if (segments.length > 0) segments.pop()
      else ascent++
    } else if (segment !== here && segment !== '') {
      segments.push(segment)
    }
  }

  return { ascent, segments }
}

/**
 * Optional hints to select the known path kind for explicit target codecs.
 *
 * Directory syntax always wins; otherwise explicit constructors use their known
 * kind, while hintless analysis follows the literal grammar's file default.
 */
export interface AnalyzerOptions {
  /** Known path kind for non-directory syntax. */
  hint?: 'file' | 'dir'
}

/**
 * Parse a path string into its kind, absoluteness, and folded segments.
 * Ascending above the root clamps: `/a/../../b` decodes as `/b` (POSIX `/..` semantics).
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
    return Analysis.dir({ isPathAbsolute: true, ascent: 0, segments: [] })
  }

  // Directory syntax is explicit; every other hintless input defaults to a file.
  const hasDirectorySyntax =
    input === '' ||
    input === here ||
    input === herePrefix ||
    input === ascentSegment ||
    input === ascentPrefix ||
    input.endsWith(separator)
  const isDirectory = hasDirectorySyntax || options?.hint === 'dir'

  // Strip the leading slash / `../` / `./` markers, count parent refs.
  let normalized = isAbsolute ? input.slice(separator.length) : input
  let parentRefs = 0
  while (normalized.startsWith(ascentPrefix)) {
    parentRefs++
    normalized = normalized.slice(ascentPrefix.length)
  }
  if (normalized.startsWith(herePrefix)) normalized = normalized.slice(herePrefix.length)
  if (isDirectory && normalized.endsWith(separator)) normalized = normalized.slice(0, -1)

  const rawSegments = normalized ? normalized.split(separator).filter((s) => s !== '') : []
  // Absolute paths can't escape root, so their ascent count is always 0.
  const { ascent, segments: normalizedSegments } = normalizeWithAscent(
    isAbsolute ? 0 : parentRefs,
    rawSegments,
  )
  const finalAscent = isAbsolute ? 0 : ascent

  if (isDirectory) {
    return Analysis.dir({
      isPathAbsolute: isAbsolute,
      ascent: finalAscent,
      segments: normalizedSegments,
    })
  }
  if (normalizedSegments.length === 0) {
    return Analysis.file({
      isPathAbsolute: isAbsolute,
      ascent: finalAscent,
      segments: [],
      fileName: '',
    })
  }

  return Analysis.file({
    isPathAbsolute: isAbsolute,
    ascent: finalAscent,
    segments: normalizedSegments.slice(0, -1),
    fileName: normalizedSegments[normalizedSegments.length - 1]!,
  })
}

/**
 * The core curried validator: parse `input`, narrow it to `kind`, and require the
 * given absoluteness. Every public path analyzer is a partial application of this.
 */
const analyzeAs =
  <$K extends Analysis['_tag']>(kind: $K) =>
  (anchoring: 'absolute' | 'relative') =>
  (input: string): Result.Result<Data.TaggedEnum.Value<Analysis, $K>, SchemaIssue.Issue> => {
    if (input === '') return Result.fail(emptyPath)
    const analysis = analyze(input, { hint: kind })
    if (!Analysis.$is(kind)(analysis)) {
      return Result.fail(
        invalid(input, kind === 'dir' ? targetDescription.Dir : targetDescription.File),
      )
    }
    return analysis.isPathAbsolute !== (anchoring === 'absolute')
      ? Result.fail(
          invalid(input, anchoring === 'absolute' ? targetDescription.Abs : targetDescription.Rel),
        )
      : Result.succeed(analysis)
  }

/** Require a file of the given absoluteness. */
export const analyzeFile = analyzeAs('file')

/** Require a directory of the given absoluteness. */
export const analyzeDir = analyzeAs('dir')

/** Require an absolute file path. */
export const analyzeFileAbs = analyzeFile('absolute')

/** Require a relative file path. */
export const analyzeFileRel = analyzeFile('relative')

/** Require an absolute directory path. */
export const analyzeDirAbs = analyzeDir('absolute')

/** Require a relative directory path. */
export const analyzeDirRel = analyzeDir('relative')

/** Split a filename into stem + extension (a leading dot is part of the stem). */
const splitExtension = (fileName: string): { stem: string; extension: string | null } => {
  const dotIndex = fileName.lastIndexOf('.')
  const hasExtension = dotIndex > 0 && dotIndex < fileName.length - 1
  return {
    stem: hasExtension ? fileName.substring(0, dotIndex) : fileName,
    extension: hasExtension ? fileName.substring(dotIndex) : null,
  }
}

/** Issue raised when a filename input is actually a path (has segments). */
const notABareFilename = new SchemaIssue.InvalidValue(Option.none(), {
  message: 'Expected a bare filename, not a path',
})

/** Issue raised when a filename contains the POSIX path terminator byte. */
const nullByteInFileName = new SchemaIssue.InvalidValue(Option.none(), {
  message: 'Filename cannot contain NUL',
})

/** A bare filename (a relative, segment-less file) parsed into stem + extension. */
export const analyzeFileName = flow(
  (input: string) =>
    input.includes(nullByte) ? Result.fail(nullByteInFileName) : analyzeFileRel(input),
  Result.flatMap((analysis) =>
    analysis.segments.length > 0
      ? Result.fail(notABareFilename)
      : Result.succeed(splitExtension(analysis.fileName)),
  ),
)

/**
 * Build a path string — the inverse of {@link analyze}. Curried: fix the path shape
 * (absoluteness, `ascent`, optional `fileName`), then apply the segments.
 *
 * `fileName` present → a file path; absent → a directory path (trailing `/`).
 * Relative paths get one leading `../` per `ascent` step, or `./` when `ascent` is 0.
 */
export const format =
  (parts: { isPathAbsolute: boolean; ascent: number; fileName?: string | null }) =>
  (segments: readonly string[]): string => {
    const body = segments.join(separator)
    const file = parts.fileName ?? null

    if (parts.isPathAbsolute) {
      if (file !== null)
        return body ? `${separator}${body}${separator}${file}` : `${separator}${file}`
      return body ? `${separator}${body}${separator}` : separator
    }

    // One `../` per ascent step, else `./`.
    const prefix = parts.ascent > 0 ? ascentPrefix.repeat(parts.ascent) : herePrefix
    if (file !== null) return body ? `${prefix}${body}${separator}${file}` : `${prefix}${file}`
    return body ? `${prefix}${body}${separator}` : prefix
  }
