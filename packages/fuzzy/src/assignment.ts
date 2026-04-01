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
  let prevClass: CharClass = CharClass.White

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
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => occurrences[a]!.length - occurrences[b]!.length,
  )

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

  const sortBuf = new Array<number>(n)
  let currentScore = computeScore(
    assigned,
    needleCodes,
    haystackCodes,
    bonuses,
    classes,
    n,
    m,
    sortBuf,
  )

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
        const newScore = computeScore(
          assigned,
          needleCodes,
          haystackCodes,
          bonuses,
          classes,
          n,
          m,
          sortBuf,
        )

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
        const newScore = computeScore(
          assigned,
          needleCodes,
          haystackCodes,
          bonuses,
          classes,
          n,
          m,
          sortBuf,
        )

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
  classes: number[],
  n: number,
  m: number,
  sortBuf: number[] = [],
): number => {
  if (n === 0) return 0

  let score = 0

  // 1. Per-position: ScoreMatch + boundary bonus + case match + consonant weight
  for (let i = 0; i < n; i++) {
    const pos = assigned[i]!
    score += ScoreMatch + bonuses[pos]!
    if (needleCodes[i] === haystackCodes[pos]!) score += CaseMatchBonus

    // Consonant weight: consonants carry more information than vowels in
    // English identifiers. Award a small bonus for consonant matches.
    // Vowels: a, e, i, o, u (lowercase charCodes: 97, 101, 105, 111, 117)
    const lowerCode = toLower(haystackCodes[pos]!)
    if (classes[pos] === CharClass.Lower || classes[pos] === CharClass.Upper) {
      if (
        lowerCode !== 97 &&
        lowerCode !== 101 &&
        lowerCode !== 105 &&
        lowerCode !== 111 &&
        lowerCode !== 117
      ) {
        score += 2 // consonant bonus
      }
    }
  }

  // 2. Gap penalty between sorted positions (sort a copy to avoid mutating assigned)
  for (let k = 0; k < n; k++) sortBuf[k] = assigned[k]!
  sortBuf.length = n
  sortBuf.sort((a, b) => a - b)
  for (let k = 1; k < sortBuf.length; k++) {
    const gap = sortBuf[k]! - sortBuf[k - 1]! - 1
    if (gap > 0) {
      score += ScoreGapStart + (gap - 1) * ScoreGapExtension
    }
  }

  // 3. Coverage ratio bonus: needle_len / haystack_len, scaled
  const coverageRatio = n / m
  score += coverageRatio * 10

  // 3b. Window compactness: bonus for tight clustering of matched positions.
  // The window is (max position - min position + 1). A perfect cluster
  // where window === n gets the maximum bonus. Larger windows get less.
  // This supplements gap penalty with a global density signal.
  const minPos = sortBuf[0]!
  const maxPos = sortBuf[n - 1]!
  const windowSize = maxPos - minPos + 1
  // Bonus: higher for tighter windows. Scale: (n / windowSize) × 5
  // Perfect cluster: n/n × 5 = 5. Fully spread: n/m × 5 ≈ 0.
  if (windowSize > 0) {
    score += (n / windowSize) * 5
  }

  // 4. Order-coherence gradient: LIS length of assigned positions in needle order.
  const lisLength = longestIncreasingSubsequence(assigned)
  score += lisLength * 2

  // 4b. Subsequence order bonus: if ALL positions are monotonically increasing,
  // the needle happens to be a subsequence. Award a large bonus — this means
  // the match preserves the user's character order, which is a strong signal.
  if (lisLength === n) {
    score += 8 // roughly one boundary bonus worth
  }

  // 5. Acronym alignment: if ALL needle chars land on word-start boundaries,
  // award an acronym bonus. This replaces per-position edge hits when higher.
  let allOnBoundaries = n > 0
  for (let i = 0; i < n; i++) {
    const bonusValue = bonuses[assigned[i]!]!
    if (bonusValue === 0) {
      allOnBoundaries = false
      break
    }
  }
  if (allOnBoundaries) {
    // Acronym score: BonusBoundary(8) × n — a strong, unified signal
    const acronymScore = 8 * n
    // Per-position bonuses already added in step 1. If acronym score exceeds
    // the sum of individual bonuses, add the difference (replacement semantics).
    let perPositionBonusSum = 0
    for (let i = 0; i < n; i++) perPositionBonusSum += bonuses[assigned[i]!]!
    if (acronymScore > perPositionBonusSum) {
      score += acronymScore - perPositionBonusSum
    }
  }

  // 6. Word-level boosters for multi-word haystacks
  // Only triggers for haystacks with whitespace/delimiter word boundaries.
  const wordStarts = findWordStarts(classes, m)
  if (wordStarts.length > 1) {
    // Word coverage breadth: how many distinct words have at least one match?
    // Matching across multiple words shows broader recall of the command.
    const wordsHit = new Set<number>()
    for (let i = 0; i < n; i++) {
      const pos = assigned[i]!
      // Find which word this position belongs to
      let wordIdx = 0
      for (let w = wordStarts.length - 1; w >= 0; w--) {
        if (pos >= wordStarts[w]!) {
          wordIdx = w
          break
        }
      }
      wordsHit.add(wordIdx)
    }
    // Bonus per word covered: 6 points × number of distinct words hit
    score += wordsHit.size * 6

    // Scope narrowing: if early needle chars match the first word's prefix
    // and remaining chars land in later words, the user is scoping then
    // discriminating. Award a bonus for this pattern.
    if (n >= 2 && wordsHit.size >= 2) {
      // Check if the first needle char lands in word 0
      let firstCharWordIdx = -1
      for (let w = wordStarts.length - 1; w >= 0; w--) {
        if (assigned[0]! >= wordStarts[w]!) {
          firstCharWordIdx = w
          break
        }
      }
      // Check if the last needle char lands in a later word
      let lastCharWordIdx = -1
      for (let w = wordStarts.length - 1; w >= 0; w--) {
        if (assigned[n - 1]! >= wordStarts[w]!) {
          lastCharWordIdx = w
          break
        }
      }
      if (firstCharWordIdx === 0 && lastCharWordIdx > 0) {
        score += 4 // scope narrowing bonus
      }
    }

    // Complete-word hit: if needle exactly matches an entire haystack word
    const needleLowerStr = needleCodes.map((c) => String.fromCharCode(toLower(c))).join('')
    for (let w = 0; w < wordStarts.length; w++) {
      const wStart = wordStarts[w]!
      const wEnd = w + 1 < wordStarts.length ? wordStarts[w + 1]! : m
      let wEndTrimmed = wEnd
      while (
        wEndTrimmed > wStart &&
        (classes[wEndTrimmed - 1] === CharClass.White ||
          classes[wEndTrimmed - 1] === CharClass.Delimiter)
      )
        wEndTrimmed--
      let word = ''
      for (let j = wStart; j < wEndTrimmed; j++)
        word += String.fromCharCode(toLower(haystackCodes[j]!))
      if (word === needleLowerStr) {
        score += 10
        break
      }
    }

    // Tail-word weight: matches in later words are more informative.
    // In command paths, the last word is the most specific.
    const lastWordStart = wordStarts[wordStarts.length - 1]!
    for (let i = 0; i < n; i++) {
      if (assigned[i]! >= lastWordStart) {
        score += 5 // tail-word bonus per character matching in the last word
      }
    }
  }

  return score
}

/**
 * Find word start positions in the haystack.
 * A word starts at position 0 and after whitespace or delimiter characters.
 * CamelCase transitions are NOT word starts — they're internal structure.
 */
const findWordStarts = (classes: number[], m: number): number[] => {
  const starts: number[] = [0]
  for (let j = 1; j < m; j++) {
    const prevCls = classes[j - 1]!
    if (prevCls === CharClass.White || prevCls === CharClass.Delimiter) {
      starts.push(j)
    }
  }
  return starts
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

import { toLower } from './utils.js'
