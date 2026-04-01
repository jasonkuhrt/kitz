import { classifyHaystack, subsequenceScore } from './subsequence.js'
import { CharClass, ScoreMatch } from './constants.js'

export interface TokenMatchResult {
  readonly score: number
  readonly positions: number[]
}

/**
 * Token-level matching: split needle on spaces, match each term as a
 * subsequence against the haystack independently. Terms can match in
 * any order. A reorder penalty applies when the match order differs
 * from the needle order (detected at the word level).
 *
 * Returns `null` when any term cannot be found in the haystack,
 * or when the needle contains only whitespace (no terms).
 */
export const tokenMatch = (needle: string, haystack: string): TokenMatchResult | null => {
  const terms = needle.split(' ').filter((t) => t.length > 0)
  // All-whitespace needle: no terms to match but the needle wasn't empty,
  // so this is not a vacuous match — fall through to character-level matching.
  if (terms.length === 0) return null

  // Pre-compute haystack classification once, shared across all term scoring calls.
  const classification = classifyHaystack(haystack)

  const haystackLower = haystack.toLowerCase()
  const allPositions: number[] = []
  const termFirstPositions: number[] = []
  const termScores: number[] = []

  for (const term of terms) {
    // Try subsequence match of term against full haystack, reusing classification
    const subseq = subsequenceScore(term, haystack, classification)
    if (subseq !== null) {
      termScores.push(subseq.score)
      allPositions.push(...subseq.positions)
      termFirstPositions.push(subseq.positions[0] ?? 0)
    } else {
      // Term doesn't match as subsequence — try containment
      const termLower = term.toLowerCase()
      const idx = haystackLower.indexOf(termLower)
      if (idx === -1) return null // term not found
      termScores.push(ScoreMatch * term.length) // base score for containment
      for (let i = 0; i < term.length; i++) {
        allPositions.push(idx + i)
      }
      termFirstPositions.push(idx)
    }
  }

  // Sum term scores
  let total = termScores.reduce((a, b) => a + b, 0)

  // Reorder penalty: detect whether terms match haystack words in needle order.
  // Find which haystack word each term primarily matches (by first character
  // position), then check if word indices are monotonically increasing.
  // Word boundaries include whitespace, delimiters, AND camelCase transitions.
  const wordStarts = findTokenWordStarts(haystack, classification)
  const termWordIndices = termFirstPositions.map((pos) => {
    for (let w = wordStarts.length - 1; w >= 0; w--) {
      if (pos >= wordStarts[w]!) return w
    }
    return 0
  })

  let inOrder = true
  for (let i = 1; i < termWordIndices.length; i++) {
    if (termWordIndices[i]! < termWordIndices[i - 1]!) {
      inOrder = false
      break
    }
  }
  if (!inOrder) {
    // Multiplicative penalty ensures reordered terms always rank below in-order.
    // A flat penalty (-5) is too small when word-level boosters add 10-20+ points.
    total = Math.round(total * 0.7)
  }

  return { score: total, positions: allPositions }
}

/**
 * Find word start positions including camelCase transitions.
 * Unlike the subsequence/assignment word-start finders (which only use
 * whitespace/delimiters), this includes camelCase boundaries because
 * token match needs to detect reordering at the semantic word level.
 */
const findTokenWordStarts = (
  haystack: string,
  classification: { classes: number[]; bonuses: number[] },
): number[] => {
  const m = haystack.length
  const starts: number[] = [0]
  for (let j = 1; j < m; j++) {
    const prevCls = classification.classes[j - 1]!
    const currCls = classification.classes[j]!
    // Whitespace/delimiter boundary
    if (prevCls === CharClass.White || prevCls === CharClass.Delimiter) {
      starts.push(j)
    }
    // CamelCase transition: lowercase → uppercase
    else if (prevCls === CharClass.Lower && currCls === CharClass.Upper) {
      starts.push(j)
    }
  }
  return starts
}
