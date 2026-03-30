import { boundaryBonus, charClassOf } from './character-class.js'
import {
  BonusConsecutive,
  BonusFirstCharMultiplier,
  CaseMatchBonus,
  CharClass,
  ScoreGapExtension,
  ScoreGapStart,
  ScoreMatch,
} from './constants.js'

/**
 * Two-matrix DP scorer for subsequence matching.
 *
 * This implements fzy's algorithm with fzf's scoring constants:
 * - M[i][j]: best score aligning needle[0..i-1] against haystack[0..j-1]
 * - D[i][j]: best score where haystack[j-1] IS the match for needle[i-1]
 *
 * Returns the optimal score and the positions where needle characters matched,
 * or null if the needle is not a subsequence of the haystack.
 *
 * The algorithm runs in O(n×m) time where n = needle length, m = haystack length.
 */
export const subsequenceScore = (
  needle: string,
  haystack: string,
): { score: number; positions: number[] } | null => {
  const n = needle.length
  const m = haystack.length

  // Empty needle: score 0, no positions
  if (n === 0) return { score: 0, positions: [] }

  // Quick check: is needle a subsequence of haystack?
  // Linear scan, O(m) time. Avoids allocating matrices for non-matches.
  if (!isSubsequence(needle, haystack)) return null

  // ---------------------------------------------------------------
  // Phase 1: Precompute haystack character classes and boundary bonuses
  // ---------------------------------------------------------------

  // Classify each haystack character. The start of the string is treated
  // as if preceded by a White character (so position 0 always earns
  // BonusBoundaryWhite).
  const classes = new Array<number>(m)
  const bonuses = new Array<number>(m)
  let prevClass: number = CharClass.White // start of string = White

  for (let j = 0; j < m; j++) {
    const charCode = haystack.charCodeAt(j)
    const currClass = charClassOf(charCode)
    classes[j] = currClass
    bonuses[j] = boundaryBonus(prevClass, currClass)
    prevClass = currClass
  }

  // ---------------------------------------------------------------
  // Phase 2: Fill M and D matrices
  // ---------------------------------------------------------------
  //
  // M[i][j] = best score for aligning needle[0..i-1] with haystack[0..j-1],
  //           considering all possible alignments (match or gap at position j).
  //
  // D[i][j] = best score for aligning needle[0..i-1] with haystack[0..j-1],
  //           where haystack[j-1] IS the match for needle[i-1].
  //           (best score "ending in a match" at position j)
  //
  // Base cases:
  //   M[0][j] = 0   (no needle chars matched = score zero)
  //   D[0][j] = -∞  (cannot end in a match with zero needle chars)
  //
  // We also track the "first bonus in the current consecutive chunk" for
  // the consecutive chunk rule.

  const NEG_INF = -Infinity

  // Allocate as flat arrays for cache efficiency.
  // Index: i * (m+1) + j, where i = 0..n, j = 0..m
  const stride = m + 1
  const M = new Float64Array((n + 1) * stride)
  const D = new Float64Array((n + 1) * stride)

  // Track the boundary bonus of the first match in each consecutive chunk.
  // This is needed for the consecutive chunk rule: when extending a run,
  // the bonus is max(currentBonus, firstBonusInChunk, BonusConsecutive).
  const firstBonusInChunk = new Float64Array((n + 1) * stride)

  // Base cases: M[0][j] = 0 (default in Float64Array), D[0][j] = -∞
  for (let j = 0; j <= m; j++) {
    D[j] = NEG_INF // D[0][j]
  }

  // Fill row by row
  for (let i = 1; i <= n; i++) {
    const needleCharCode = needle.charCodeAt(i - 1)
    const needleLower = toLower(needleCharCode)

    // D[i][0] = -∞ (can't match needle chars with empty haystack prefix)
    D[i * stride] = NEG_INF

    // M[i][0] = -∞ (can't match i>0 needle chars with empty haystack)
    // We need M[i][0] = -∞ so that gapping from it doesn't produce valid scores.
    // But we handle this implicitly: M[i][0] starts at 0 from Float64Array,
    // and we won't gap into it. Actually we need it to be -∞.
    M[i * stride] = NEG_INF

    for (let j = 1; j <= m; j++) {
      const haystackCharCode = haystack.charCodeAt(j - 1)
      const haystackLower = toLower(haystackCharCode)

      const idx = i * stride + j

      // Default: no match at this cell
      D[idx] = NEG_INF

      if (needleLower === haystackLower) {
        // Characters match (case-insensitive).
        const bonus = bonuses[j - 1]!

        // Case match bonus: exact case agreement earns +CaseMatchBonus
        const caseBonus = needleCharCode === haystackCharCode ? CaseMatchBonus : 0

        // First character multiplier: the first matched character's bonus is doubled
        const effectiveBonus = i === 1 ? bonus * BonusFirstCharMultiplier : bonus

        // Option A: start a new match run (not extending a consecutive chunk)
        // Score = M[i-1][j-1] + ScoreMatch + bonus
        const prevM = M[(i - 1) * stride + (j - 1)]
        const newRunScore = prevM + ScoreMatch + effectiveBonus + caseBonus

        // Option B: extend a consecutive run
        // Score = D[i-1][j-1] + ScoreMatch + max(bonus, firstBonusInChunk, BonusConsecutive)
        const prevD = D[(i - 1) * stride + (j - 1)]
        let extendScore = NEG_INF
        if (prevD > NEG_INF) {
          const prevFirstBonus = firstBonusInChunk[(i - 1) * stride + (j - 1)]!
          const consecutiveBonus = Math.max(bonus, prevFirstBonus, BonusConsecutive)
          const effectiveConsecutiveBonus = i === 1 ? consecutiveBonus * BonusFirstCharMultiplier : consecutiveBonus
          extendScore = prevD + ScoreMatch + effectiveConsecutiveBonus + caseBonus
        }

        if (newRunScore >= extendScore) {
          D[idx] = newRunScore
          // New run: this position's bonus becomes the first bonus in the chunk
          firstBonusInChunk[idx] = effectiveBonus
        } else {
          D[idx] = extendScore
          // Extending: carry forward the first bonus from the previous chunk
          firstBonusInChunk[idx] = firstBonusInChunk[(i - 1) * stride + (j - 1)]!
        }
      }

      // M[i][j] = max(D[i][j], M[i][j-1] + gapPenalty)
      //
      // Gap penalty is affine:
      //   - ScoreGapStart (-3) for the first skipped character
      //   - ScoreGapExtension (-1) for each additional skip
      //
      // We detect "first gap" vs "extending gap" by checking whether
      // M[i][j-1] came from D[i][j-1] (which would mean position j-2
      // was a match, so j-1 starts a new gap) or from M[i][j-2]+gap
      // (extending an existing gap).
      //
      // Simpler approximation used by fzy: always use ScoreGapStart for
      // the first position after a match, ScoreGapExtension otherwise.
      // We track this with a boolean per row.

      // Gap penalty: cost of skipping haystack character j-1.
      //
      // Important: gap penalties only apply BETWEEN matched needle characters
      // (i.e., when i < n, or when not all needle chars have been matched yet
      // at position j). After the last needle character is matched, trailing
      // haystack characters don't reduce the score — they're just extra text.
      //
      // We implement this by not applying gap penalties when i == n and all
      // needle chars have been matched (D[n][j'] > -∞ for some j' < j).
      // However, this is tricky to detect. The simpler equivalent: use the
      // max of M[n][j] across all j as the final score (see Phase 3).

      const gapScore = M[i * stride + (j - 1)]
      let gapPenalty: number
      if (gapScore <= NEG_INF) {
        gapPenalty = 0 // No valid score to gap from
      } else if (D[i * stride + (j - 1)] === M[i * stride + (j - 1)]) {
        // Previous position was a match → opening a new gap
        gapPenalty = ScoreGapStart
      } else {
        // Previous position was already a gap → extending
        gapPenalty = ScoreGapExtension
      }

      const gapOption = gapScore > NEG_INF ? gapScore + gapPenalty : NEG_INF

      M[idx] = Math.max(D[idx], gapOption)
    }
  }

  // ---------------------------------------------------------------
  // Phase 3: Find optimal score and traceback positions
  // ---------------------------------------------------------------
  //
  // The final score is max(D[n][j]) for all j — the best position where
  // the last needle character lands. We use D (not M) because the score
  // should reflect the alignment ending at a match, not trailing gaps.
  // Trailing haystack characters after the last match don't reduce the
  // score — they're just extra text.
  //
  // By taking the max over j, we avoid penalizing trailing gaps entirely.
  // This is consistent with fzy's approach.

  let finalScore = NEG_INF
  let bestJ = 0

  for (let jj = 1; jj <= m; jj++) {
    const d = D[n * stride + jj]
    if (d > finalScore) {
      finalScore = d
      bestJ = jj
    }
  }

  if (finalScore <= NEG_INF) {
    // Should not happen if isSubsequence passed, but safety guard
    return null
  }

  // Traceback: walk backwards from the best end position through D
  // to find which haystack positions the needle characters matched.
  // When multiple alignments produce the same score, prefer earlier
  // positions (leftmost optimal alignment).

  const positions = new Array<number>(n)
  let i = n
  let j = bestJ

  while (i > 0 && j > 0) {
    const idx = i * stride + j

    if (D[idx] === M[idx] && D[idx] > NEG_INF) {
      // Position j-1 is a match for needle[i-1]
      positions[i - 1] = j - 1
      i--
      j--
    } else {
      // This position was a gap — move left
      j--
    }
  }

  return { score: Math.round(finalScore), positions }
}

/**
 * Quick linear check: is needle a subsequence of haystack? (case-insensitive)
 * O(m) time, zero allocations.
 */
const isSubsequence = (needle: string, haystack: string): boolean => {
  let ni = 0
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (toLower(needle.charCodeAt(ni)) === toLower(haystack.charCodeAt(hi))) {
      ni++
    }
  }
  return ni === needle.length
}

/** ASCII-only case folding: A-Z → a-z */
const toLower = (charCode: number): number =>
  charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode
