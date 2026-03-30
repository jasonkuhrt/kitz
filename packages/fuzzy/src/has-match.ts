/**
 * Multiset containment check. Returns true when every character in the needle
 * exists in the haystack with at least the same multiplicity (case-insensitive).
 *
 * This is the match gate for @kitz/fuzzy. Unlike traditional fuzzy matchers
 * that require a subsequence (characters in order), this checks only that
 * the characters are present — regardless of order. This eliminates the
 * zero-results cliff: a scrambled query produces a low score, not no result.
 *
 * O(n + m) time where n = needle length, m = haystack length.
 */
export const hasMatch = (needle: string, haystack: string): boolean => {
  if (needle.length === 0) return true
  if (needle.length > haystack.length) return false

  // Build character frequency map from haystack (case-folded).
  // Using a Map rather than a fixed-size array to handle non-ASCII correctly.
  const counts = new Map<number, number>()
  for (let i = 0; i < haystack.length; i++) {
    const ch = toLower(haystack.charCodeAt(i))
    counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }

  // Check each needle character has sufficient count in haystack
  for (let i = 0; i < needle.length; i++) {
    const ch = toLower(needle.charCodeAt(i))
    const remaining = counts.get(ch) ?? 0
    if (remaining <= 0) return false
    counts.set(ch, remaining - 1)
  }

  return true
}

/** ASCII-only case folding: A-Z → a-z. Non-ASCII passes through unchanged. */
const toLower = (charCode: number): number =>
  charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode
