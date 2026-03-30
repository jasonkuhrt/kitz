import { boundaryBonus, charClassOf } from './character-class.js'
import {
  BonusFirstCharMultiplier,
  CaseMatchBonus,
  CharClass,
  ScoreGapExtension,
  ScoreGapStart,
  ScoreMatch,
} from './constants.js'

/**
 * Order-independent assignment scorer.
 *
 * Activates when the needle passes multiset containment but is NOT a subsequence
 * of the haystack. Assigns each needle character to a haystack position using
 * greedy-by-bonus seed + repair pass.
 *
 * Returns the score and positions (in needle order), or null if multiset
 * containment fails.
 */
export const assignmentScore = (
  needle: string,
  haystack: string,
): { score: number; positions: number[] } | null => {
  const n = needle.length
  const m = haystack.length

  if (n === 0) return { score: 0, positions: [] }
  if (n > m) return null

  // ---------------------------------------------------------------
  // Phase 0: Multiset containment check + build occurrence index
  // ---------------------------------------------------------------
  //
  // For each lowercase needle character, find ALL matching positions
  // in the haystack. If any needle character has insufficient occurrences,
  // return null.

  const needleLower = new Array<number>(n)
  const needleCodes = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    needleCodes[i] = needle.charCodeAt(i)
    needleLower[i] = toLower(needleCodes[i]!)
  }

  // Classify haystack characters and compute bonuses
  const classes = new Array<number>(m)
  const bonuses = new Array<number>(m)
  const haystackCodes = new Array<number>(m)
  let prevClass: number = CharClass.White

  for (let j = 0; j < m; j++) {
    const charCode = haystack.charCodeAt(j)
    haystackCodes[j] = charCode
    const currClass = charClassOf(charCode)
    classes[j] = currClass
    bonuses[j] = boundaryBonus(prevClass, currClass)
    // First character multiplier: position 0 always gets doubled bonus
    if (j === 0) bonuses[j]! *= BonusFirstCharMultiplier
    prevClass = currClass
  }

  // Build occurrence lists: for each needle char (lowered), all haystack positions
  // where it matches (case-insensitive).
  const occurrences: number[][] = new Array(n)
  const needleCharCounts = new Map<number, number>()

  for (let i = 0; i < n; i++) {
    const ch = needleLower[i]!
    needleCharCounts.set(ch, (needleCharCounts.get(ch) ?? 0) + 1)
  }

  // Count haystack occurrences
  const haystackCharCounts = new Map<number, number>()
  for (let j = 0; j < m; j++) {
    const ch = toLower(haystackCodes[j]!)
    haystackCharCounts.set(ch, (haystackCharCounts.get(ch) ?? 0) + 1)
  }

  // Containment check
  for (const [ch, count] of needleCharCounts) {
    if ((haystackCharCounts.get(ch) ?? 0) < count) return null
  }

  // Build occurrence index per needle position
  for (let i = 0; i < n; i++) {
    const ch = needleLower[i]!
    const positions: number[] = []
    for (let j = 0; j < m; j++) {
      if (toLower(haystackCodes[j]!) === ch) positions.push(j)
    }
    occurrences[i] = positions
  }

  // ---------------------------------------------------------------
  // Phase 1: Greedy seed — assign each needle char to highest-bonus position
  // ---------------------------------------------------------------

  const assigned = new Array<number>(n).fill(-1)
  const used = new Set<number>()

  // Sort needle indices by number of available positions (ascending) —
  // characters with fewer options get assigned first to avoid conflicts.
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => occurrences[a]!.length - occurrences[b]!.length)

  for (const i of order) {
    let bestPos = -1
    let bestBonus = -Infinity

    for (const pos of occurrences[i]!) {
      if (used.has(pos)) continue
      const b = bonuses[pos]! + (needleCodes[i] === haystackCodes[pos]! ? CaseMatchBonus : 0)
      if (b > bestBonus) {
        bestBonus = b
        bestPos = pos
      }
    }

    if (bestPos === -1) return null // shouldn't happen after containment check
    assigned[i] = bestPos
    used.add(bestPos)
  }

  // ---------------------------------------------------------------
  // Phase 2: Repair pass — swap repeated-character assignments for better global score
  // ---------------------------------------------------------------
  //
  // For each needle character that has multiple candidate positions,
  // try swapping its assignment with each alternative. Accept the swap
  // if the global score improves.

  let currentScore = computeScore(assigned, needleCodes, haystackCodes, bonuses, n, m)

  for (const i of order) {
    if (occurrences[i]!.length <= 1) continue // no alternatives

    const currentPos = assigned[i]!
    for (const altPos of occurrences[i]!) {
      if (altPos === currentPos) continue
      if (used.has(altPos)) {
        // altPos is used by another needle char — try swapping
        const otherI = assigned.indexOf(altPos)
        if (otherI === -1) continue
        // Check that the other needle char can also use currentPos
        if (toLower(haystackCodes[currentPos]!) !== needleLower[otherI]!) continue

        // Try the swap
        assigned[i] = altPos
        assigned[otherI] = currentPos
        const newScore = computeScore(assigned, needleCodes, haystackCodes, bonuses, n, m)

        if (newScore > currentScore) {
          // Accept swap
          currentScore = newScore
        } else {
          // Revert
          assigned[i] = currentPos
          assigned[otherI] = altPos
        }
      } else {
        // altPos is free — just try reassigning
        assigned[i] = altPos
        used.delete(currentPos)
        used.add(altPos)
        const newScore = computeScore(assigned, needleCodes, haystackCodes, bonuses, n, m)

        if (newScore > currentScore) {
          currentScore = newScore
        } else {
          // Revert
          assigned[i] = currentPos
          used.delete(altPos)
          used.add(currentPos)
        }
      }
    }
  }

  return { score: Math.round(currentScore), positions: [...assigned] }
}

/**
 * Compute the global score for a set of assigned positions.
 *
 * Score components:
 * 1. ScoreMatch + boundary bonus per position
 * 2. Case match bonus per position
 * 3. Gap penalty between sorted positions (affine)
 * 4. Coverage ratio: needle_len / haystack_len
 * 5. Order-coherence gradient: LIS length of positions in needle order
 */
const computeScore = (
  assigned: number[],
  needleCodes: number[],
  haystackCodes: number[],
  bonuses: number[],
  n: number,
  m: number,
): number => {
  if (n === 0) return 0

  let score = 0

  // 1. Per-position: ScoreMatch + boundary bonus + case match
  for (let i = 0; i < n; i++) {
    const pos = assigned[i]!
    score += ScoreMatch + bonuses[pos]!
    if (needleCodes[i] === haystackCodes[pos]!) score += CaseMatchBonus
  }

  // 2. Gap penalty between sorted positions
  const sorted = [...assigned].sort((a, b) => a - b)
  for (let k = 1; k < sorted.length; k++) {
    const gap = sorted[k]! - sorted[k - 1]! - 1
    if (gap > 0) {
      score += ScoreGapStart + (gap - 1) * ScoreGapExtension
    }
  }

  // 3. Coverage ratio bonus: needle_len / haystack_len, scaled
  // Shorter haystacks score higher when they contain the same characters.
  // Scale factor chosen so that a perfect 1.0 coverage adds ~10 points
  // (roughly one boundary bonus worth).
  const coverageRatio = n / m
  score += coverageRatio * 10

  // 4. Order-coherence gradient: LIS length of assigned positions in needle order.
  // Full subsequence (all in order) → bonus = n.
  // One transposition → bonus = n-1.
  // Full reversal → bonus = 1.
  // Scaled so it contributes meaningfully but doesn't dominate.
  const lisLength = longestIncreasingSubsequence(assigned)
  score += lisLength * 2

  return score
}

/**
 * Length of the longest strictly increasing subsequence.
 * O(n log n) using patience sorting.
 */
const longestIncreasingSubsequence = (arr: number[]): number => {
  if (arr.length === 0) return 0
  // tails[i] = smallest tail element for increasing subsequence of length i+1
  const tails: number[] = []

  for (const val of arr) {
    let lo = 0
    let hi = tails.length

    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (tails[mid]! < val) lo = mid + 1
      else hi = mid
    }

    tails[lo] = val
  }

  return tails.length
}

/** ASCII-only case folding: A-Z → a-z */
const toLower = (charCode: number): number =>
  charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode
