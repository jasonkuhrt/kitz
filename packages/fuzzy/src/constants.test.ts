import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import {
  BonusBoundary,
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusConsecutive,
  BonusFirstCharMultiplier,
  BonusNonWord,
  CaseMatchBonus,
  CharClass,
  ScoreGapExtension,
  ScoreGapStart,
  ScoreMatch,
} from './constants.js'

Test.describe('scoring constants')
  .on((name: string) => {
    const constants: Record<string, number> = {
      ScoreMatch,
      ScoreGapStart,
      ScoreGapExtension,
      BonusBoundaryWhite,
      BonusBoundaryDelimiter,
      BonusBoundary,
      BonusNonWord,
      BonusCamel123,
      BonusConsecutive,
      BonusFirstCharMultiplier,
      CaseMatchBonus,
    }
    return constants[name]
  })
  // dprint-ignore
  .cases(
    [['ScoreMatch'], 16],
    [['ScoreGapStart'], -3],
    [['ScoreGapExtension'], -1],
    [['BonusBoundaryWhite'], 10],
    [['BonusBoundaryDelimiter'], 9],
    [['BonusBoundary'], 8],
    [['BonusNonWord'], 8],
    [['BonusCamel123'], 7],
    [['BonusConsecutive'], 4],
    [['BonusFirstCharMultiplier'], 2],
    [['CaseMatchBonus'], 1],
  )
  .test()

test('CharClass has exactly seven classes', () => {
  expect(Object.keys(CharClass)).toHaveLength(7)
  expect(CharClass.White).toBe(0)
  expect(CharClass.NonWord).toBe(1)
  expect(CharClass.Delimiter).toBe(2)
  expect(CharClass.Lower).toBe(3)
  expect(CharClass.Upper).toBe(4)
  expect(CharClass.Letter).toBe(5)
  expect(CharClass.Number).toBe(6)
})
