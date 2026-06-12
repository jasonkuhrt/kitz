// @ts-expect-error Duplicate identifier
export * as Diff from './diff.js'

/**
 * Line-level text diffing.
 *
 * Computes a minimal line diff between two texts as pure data — a flat
 * sequence of kept, added, and removed lines (longest common subsequence) —
 * plus a unified-format renderer.
 *
 * @category Diff
 */
export namespace Diff {}
