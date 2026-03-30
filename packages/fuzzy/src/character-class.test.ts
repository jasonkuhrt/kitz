import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import {
  BonusBoundary,
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusNonWord,
  CharClass,
} from './constants.js'
import { boundaryBonus, charClassOf } from './character-class.js'

const classify = (ch: string) => charClassOf(ch.charCodeAt(0))

Test.describe('charClassOf')
  .on(classify)
  // dprint-ignore
  .cases(
    // Whitespace → White
    [[' '], CharClass.White],
    [['\t'], CharClass.White],
    [['\n'], CharClass.White],
    [['\r'], CharClass.White],
    // Delimiters
    [['-'], CharClass.Delimiter],
    [['_'], CharClass.Delimiter],
    [['/'], CharClass.Delimiter],
    // Lowercase
    [['a'], CharClass.Lower],
    [['m'], CharClass.Lower],
    [['z'], CharClass.Lower],
    // Uppercase
    [['A'], CharClass.Upper],
    [['M'], CharClass.Upper],
    [['Z'], CharClass.Upper],
    // Digits
    [['0'], CharClass.Number],
    [['5'], CharClass.Number],
    [['9'], CharClass.Number],
    // NonWord punctuation
    [['.'], CharClass.NonWord],
    [[','], CharClass.NonWord],
    [[':'], CharClass.NonWord],
    [[';'], CharClass.NonWord],
    [['!'], CharClass.NonWord],
    [['@'], CharClass.NonWord],
    [['#'], CharClass.NonWord],
    [['$'], CharClass.NonWord],
    [['%'], CharClass.NonWord],
    [['^'], CharClass.NonWord],
    [['&'], CharClass.NonWord],
    [['*'], CharClass.NonWord],
    [['+'], CharClass.NonWord],
    [['='], CharClass.NonWord],
    [['('], CharClass.NonWord],
    [[')'], CharClass.NonWord],
    [['['], CharClass.NonWord],
    [[']'], CharClass.NonWord],
    [['{'], CharClass.NonWord],
    [['}'], CharClass.NonWord],
    [['|'], CharClass.NonWord],
    [['\\'], CharClass.NonWord],
    [['?'], CharClass.NonWord],
    [['<'], CharClass.NonWord],
    [['>'], CharClass.NonWord],
    [["'"], CharClass.NonWord],
    [['"'], CharClass.NonWord],
    [['~'], CharClass.NonWord],
    [['`'], CharClass.NonWord],
    // Non-ASCII letters → Letter
    [['é'], CharClass.Letter],
    [['ü'], CharClass.Letter],
    [['ñ'], CharClass.Letter],
  )
  .test()

const bonus = (prev: string, curr: string) => boundaryBonus(classify(prev), classify(curr))

Test.describe('boundaryBonus')
  .on((prev: string, curr: string) => bonus(prev, curr))
  // dprint-ignore
  .cases(
    // White → word class = BonusBoundaryWhite
    [[' ', 'a'], BonusBoundaryWhite],
    [[' ', 'A'], BonusBoundaryWhite],
    [[' ', '0'], BonusBoundaryWhite],
    [[' ', 'é'], BonusBoundaryWhite],
    [[' ', ' '], 0],
    // Delimiter → word class = BonusBoundaryDelimiter
    [['-', 'a'], BonusBoundaryDelimiter],
    [['-', 'A'], BonusBoundaryDelimiter],
    [['_', '0'], BonusBoundaryDelimiter],
    // NonWord → word class = BonusNonWord
    [['.', 'a'], BonusNonWord],
    [['.', 'A'], BonusNonWord],
    // Lower → Upper = camelCase
    [['a', 'A'], BonusCamel123],
    // Lower → Number
    [['a', '0'], BonusCamel123],
    // Lower → Lower = no transition
    [['a', 'b'], 0],
    // Upper → Upper = no transition
    [['A', 'B'], 0],
    // Upper → Number
    [['A', '0'], BonusCamel123],
    // Number → word class = BonusBoundary
    [['0', 'a'], BonusBoundary],
    [['0', 'A'], BonusBoundary],
    [['0', '0'], 0],
    // Letter → Upper/Number = BonusBoundary
    [['é', 'A'], BonusBoundary],
    [['é', '0'], BonusBoundary],
  )
  .test()
