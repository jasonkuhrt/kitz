import { Empty } from '../type.js'
import { lines as textLines } from '../text.js'

// ─── Line ────────────────────────────────────────────────────────────────────

/**
 * A line present in both the before and after texts.
 * @category Diff
 */
export interface LineKept {
  readonly _tag: 'LineKept'
  /** The line's text, without its line ending. */
  readonly text: string
}

/**
 * A line present only in the after text.
 * @category Diff
 */
export interface LineAdded {
  readonly _tag: 'LineAdded'
  /** The line's text, without its line ending. */
  readonly text: string
}

/**
 * A line present only in the before text.
 * @category Diff
 */
export interface LineRemoved {
  readonly _tag: 'LineRemoved'
  /** The line's text, without its line ending. */
  readonly text: string
}

/**
 * One line of a line-level diff.
 *
 * Discriminated on `_tag` so it composes with Effect's `Match.tagsExhaustive`.
 *
 * @category Diff
 */
export type Line = LineKept | LineAdded | LineRemoved

/**
 * Construct a {@link LineKept}.
 * @category Diff
 * @param text - The line's text, without its line ending.
 * @returns The kept line.
 */
export const kept = (text: string): LineKept => ({ _tag: `LineKept`, text })

/**
 * Construct a {@link LineAdded}.
 * @category Diff
 * @param text - The line's text, without its line ending.
 * @returns The added line.
 */
export const added = (text: string): LineAdded => ({ _tag: `LineAdded`, text })

/**
 * Construct a {@link LineRemoved}.
 * @category Diff
 * @param text - The line's text, without its line ending.
 * @returns The removed line.
 */
export const removed = (text: string): LineRemoved => ({ _tag: `LineRemoved`, text })

// ─── Line Decomposition ──────────────────────────────────────────────────────

/**
 * Split text into the sequence of lines that {@link diff} operates on.
 *
 * Same line-ending handling as `Str.Text.lines` (LF, CRLF, and CR all
 * separate lines), with one diff-specific refinement: the empty string is
 * zero lines, not one empty line. This means:
 *
 * - `lines('')` is `[]` — an empty document has no lines, so
 *   `diff('', text)` reports every line of `text` as added with no
 *   spurious removal.
 * - A trailing newline produces a final empty line (`lines('a\n')` is
 *   `['a', '']`), so `diff('a', 'a\n')` reports the trailing-newline
 *   change as an added empty line rather than reporting no change.
 *
 * @category Diff
 * @param text - The text to decompose.
 * @returns The text's lines, without their line endings.
 * @example
 * ```typescript
 * lines('')          // []
 * lines('a')         // ['a']
 * lines('a\n')       // ['a', '']
 * lines('a\r\nb')    // ['a', 'b']
 * ```
 */
export const lines = (text: string): ReadonlyArray<string> =>
  text === Empty ? [] : textLines(text)

// ─── Diff ────────────────────────────────────────────────────────────────────

/**
 * Compute a line-level diff between two texts.
 *
 * Lines are compared by strict equality after decomposing each text with
 * {@link lines}. The result is a single flat sequence covering both texts in
 * order: every line of `before` appears exactly once as kept or removed, and
 * every line of `after` appears exactly once as kept or added. Kept lines are
 * a longest common subsequence of the two texts' lines, so the diff is
 * minimal in the number of added plus removed lines.
 *
 * Deterministic and total: equal-cost alternatives always resolve the same
 * way (removals are emitted before additions), and no input throws. Worst
 * case is O(n·m) time and space in the number of lines that differ; common
 * leading and trailing lines are trimmed first, so near-identical texts stay
 * cheap.
 *
 * @category Diff
 * @param before - The original text.
 * @param after - The revised text.
 * @returns The diff as a flat sequence of {@link Line}s.
 * @example
 * ```typescript
 * diff('a\nb\nc', 'a\nx\nc')
 * // [
 * //   { _tag: 'LineKept', text: 'a' },
 * //   { _tag: 'LineRemoved', text: 'b' },
 * //   { _tag: 'LineAdded', text: 'x' },
 * //   { _tag: 'LineKept', text: 'c' },
 * // ]
 * ```
 */
export const diff = (before: string, after: string): ReadonlyArray<Line> => {
  const beforeLines = lines(before)
  const afterLines = lines(after)

  // Trim common prefix and suffix so the O(n·m) core only sees the changed
  // region. The suffix loop stops at the prefix boundary so no line is
  // claimed by both trims.
  let prefixLength = 0
  const maxPrefixLength = Math.min(beforeLines.length, afterLines.length)
  while (prefixLength < maxPrefixLength && beforeLines[prefixLength] === afterLines[prefixLength]) {
    prefixLength++
  }

  let beforeEnd = beforeLines.length
  let afterEnd = afterLines.length
  while (
    beforeEnd > prefixLength &&
    afterEnd > prefixLength &&
    beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]
  ) {
    beforeEnd--
    afterEnd--
  }

  return [
    ...beforeLines.slice(0, prefixLength).map((text) => kept(text)),
    ...diffChangedRegion(
      beforeLines.slice(prefixLength, beforeEnd),
      afterLines.slice(prefixLength, afterEnd),
    ),
    ...beforeLines.slice(beforeEnd).map((text) => kept(text)),
  ]
}

/**
 * LCS diff of the changed region (after common prefix/suffix trimming).
 *
 * Builds the longest-common-subsequence length table for the two line
 * sequences, then walks it front-to-back emitting kept, removed, and added
 * lines. Ties prefer removal, so removals are always emitted before the
 * additions that replace them.
 */
const diffChangedRegion = (
  beforeLines: ReadonlyArray<string>,
  afterLines: ReadonlyArray<string>,
): ReadonlyArray<Line> => {
  const beforeCount = beforeLines.length
  const afterCount = afterLines.length
  if (beforeCount === 0) return afterLines.map((text) => added(text))
  if (afterCount === 0) return beforeLines.map((text) => removed(text))

  // lcsLengths[i * width + j] = length of the longest common subsequence of
  // beforeLines.slice(i) and afterLines.slice(j).
  const width = afterCount + 1
  const lcsLengths = new Uint32Array((beforeCount + 1) * width)
  for (let i = beforeCount - 1; i >= 0; i--) {
    for (let j = afterCount - 1; j >= 0; j--) {
      lcsLengths[i * width + j] =
        beforeLines[i] === afterLines[j]
          ? (lcsLengths[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lcsLengths[(i + 1) * width + j] ?? 0, lcsLengths[i * width + j + 1] ?? 0)
    }
  }

  const result: Line[] = []
  let i = 0
  let j = 0
  while (i < beforeCount && j < afterCount) {
    const beforeLine = beforeLines[i] as string
    const afterLine = afterLines[j] as string
    if (beforeLine === afterLine) {
      result.push(kept(beforeLine))
      i++
      j++
    } else if ((lcsLengths[(i + 1) * width + j] ?? 0) >= (lcsLengths[i * width + j + 1] ?? 0)) {
      result.push(removed(beforeLine))
      i++
    } else {
      result.push(added(afterLine))
      j++
    }
  }
  while (i < beforeCount) {
    result.push(removed(beforeLines[i] as string))
    i++
  }
  while (j < afterCount) {
    result.push(added(afterLines[j] as string))
    j++
  }
  return result
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const unifiedLinePrefix = {
  LineKept: ` `,
  LineAdded: `+`,
  LineRemoved: `-`,
} as const satisfies Record<Line[`_tag`], string>

/**
 * Render a diff as unified-format lines: `' '` prefix for kept lines, `'+'`
 * for added, `'-'` for removed. No hunk headers — every line of the diff is
 * rendered, in order.
 *
 * @category Diff
 * @param diffLines - A diff produced by {@link diff}.
 * @returns One rendered string per diff line.
 * @example
 * ```typescript
 * toUnifiedLines(diff('a\nb', 'a\nc'))
 * // [' a', '-b', '+c']
 * ```
 */
export const toUnifiedLines = (diffLines: ReadonlyArray<Line>): ReadonlyArray<string> =>
  diffLines.map((line) => `${unifiedLinePrefix[line._tag]}${line.text}`)
