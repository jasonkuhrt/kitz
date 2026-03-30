import {
  BonusBoundary,
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusNonWord,
  type CharClass,
  CharClass as C,
} from './constants.js'

/**
 * Classify a character code into one of seven character classes.
 *
 * ASCII characters are classified by range. Non-ASCII characters that
 * are Unicode letters (tested via regex) get `Letter`; everything else
 * gets `NonWord`.
 */
export const charClassOf = (charCode: number): CharClass => {
  // Whitespace
  if (charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13) return C.White
  // Delimiters: - _ /
  if (charCode === 45 || charCode === 95 || charCode === 47) return C.Delimiter
  // Lowercase a-z
  if (charCode >= 97 && charCode <= 122) return C.Lower
  // Uppercase A-Z
  if (charCode >= 65 && charCode <= 90) return C.Upper
  // Digits 0-9
  if (charCode >= 48 && charCode <= 57) return C.Number
  // Non-ASCII: test if it's a letter
  if (charCode > 127) {
    return unicodeLetterTest.test(String.fromCharCode(charCode)) ? C.Letter : C.NonWord
  }
  // Everything else is NonWord (punctuation, operators, brackets, etc.)
  return C.NonWord
}

const unicodeLetterTest = /\p{L}/u

/**
 * Pre-computed 7×7 boundary bonus table.
 *
 * `bonusTable[prevClass][currClass]` gives the bonus awarded when a matched
 * character at class `currClass` follows a character at class `prevClass`.
 *
 * The table follows fzf's scoring with @kitz/fuzzy's delimiter reclassification
 * (- _ / are Delimiter, not NonWord). See CONTRIBUTING.md for the full table.
 */
// prettier-ignore
const bonusTable: readonly (readonly number[])[] = [
  //                White  NonWord  Delim  Lower               Upper               Letter              Number
  /* White    */ [  0,     0,       0,     BonusBoundaryWhite, BonusBoundaryWhite, BonusBoundaryWhite, BonusBoundaryWhite ],
  /* NonWord  */ [  0,     0,       0,     BonusNonWord,       BonusNonWord,       BonusNonWord,       BonusNonWord       ],
  /* Delim    */ [  0,     0,       0,     BonusBoundaryDelimiter, BonusBoundaryDelimiter, BonusBoundaryDelimiter, BonusBoundaryDelimiter ],
  /* Lower    */ [  0,     0,       0,     0,                  BonusCamel123,      0,                  BonusCamel123      ],
  /* Upper    */ [  0,     0,       0,     0,                  0,                  0,                  BonusCamel123      ],
  /* Letter   */ [  0,     0,       0,     0,                  BonusBoundary,      0,                  BonusBoundary      ],
  /* Number   */ [  0,     0,       0,     BonusBoundary,      BonusBoundary,      BonusBoundary,      0                  ],
]

/**
 * Look up the boundary bonus for a transition between two character classes.
 * O(1) table lookup.
 */
export const boundaryBonus = (prevClass: CharClass, currClass: CharClass): number =>
  bonusTable[prevClass]![currClass]!
