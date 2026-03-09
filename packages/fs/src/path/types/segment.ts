import { Schema as S } from 'effect'

/**
 * Schema for validating path segments.
 * POSIX-compliant: segments cannot contain / (path separator) or NUL.
 * Also excludes empty strings which would create // in paths.
 */
export const Segment = S.String.pipe(
  S.filter((s) => s.length > 0, {
    message: () => 'Path segment cannot be empty',
  }),
  S.pattern(/^[^/\0]+$/, {
    message: () => 'Path segment cannot contain / or null bytes',
  }),
  S.annotations({
    identifier: 'Segment',
    description: 'A valid path segment (POSIX-compliant)',
  }),
)

/**
 * A branded type for path segments.
 * POSIX-compliant: cannot contain / or null bytes, cannot be empty.
 * Note: '.' and '..' are valid segments with special meaning.
 */
export type Segment = typeof Segment.Type

/**
 * Create a Segment from a string.
 *
 * @param segment - The segment string (must not contain / or be empty)
 * @returns A branded Segment
 */
export const make = (segment: string): Segment => Segment.make(segment)

export const encodeSync = S.encodeSync(Segment)

export const encode = S.encode(Segment)

export const decode = S.decode(Segment)

export const decodeSync = S.decodeSync(Segment)

export const decodeEither = S.decodeEither(Segment)

/**
 * Check if a value is a valid segment.
 */
export const is = S.is(Segment)

/**
 * Common special segments.
 */
export const Special = {
  /** Current directory reference */
  current: make('.'),
  /** Parent directory reference */
  parent: make('..'),
} as const

/**
 * Check if a segment is a special reference (. or ..)
 */
export const isSpecial = (segment: Segment): boolean => {
  return segment === '.' || segment === '..'
}

/**
 * Check if a segment is the current directory reference
 */
export const isCurrent = (segment: Segment): boolean => {
  return segment === '.'
}

/**
 * Check if a segment is the parent directory reference
 */
export const isParent = (segment: Segment): boolean => {
  return segment === '..'
}
