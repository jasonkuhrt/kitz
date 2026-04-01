// Scoring constants from fzf's source (src/algo/algo.go).
// These numeric values are used exactly as fzf defines them.
// See CONTRIBUTING.md for the boundary bonus transition table.

export const ScoreMatch = 16
export const ScoreGapStart = -3
export const ScoreGapExtension = -1
export const BonusBoundaryWhite = 10
export const BonusBoundaryDelimiter = 9
export const BonusBoundary = 8
export const BonusNonWord = 8
export const BonusCamel123 = 7
export const BonusConsecutive = 4
export const BonusFirstCharMultiplier = 2
export const CaseMatchBonus = 1

/**
 * Seven character classes for haystack character classification.
 * The transition between adjacent classes determines boundary bonuses.
 */
export const CharClass = {
  White: 0,
  NonWord: 1,
  Delimiter: 2,
  Lower: 3,
  Upper: 4,
  Letter: 5,
  Number: 6,
} as const

export type CharClass = (typeof CharClass)[keyof typeof CharClass]
