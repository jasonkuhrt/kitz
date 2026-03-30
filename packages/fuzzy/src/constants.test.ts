import { describe, expect, test } from 'vitest'
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

describe('scoring constants', () => {
  test('match fzf values', () => {
    expect(ScoreMatch).toBe(16)
    expect(ScoreGapStart).toBe(-3)
    expect(ScoreGapExtension).toBe(-1)
    expect(BonusBoundaryWhite).toBe(10)
    expect(BonusBoundaryDelimiter).toBe(9)
    expect(BonusBoundary).toBe(8)
    expect(BonusNonWord).toBe(8)
    expect(BonusCamel123).toBe(7)
    expect(BonusConsecutive).toBe(4)
    expect(BonusFirstCharMultiplier).toBe(2)
    expect(CaseMatchBonus).toBe(1)
  })
})

describe('CharClass enum', () => {
  test('has all seven classes with correct values', () => {
    expect(CharClass.White).toBe(0)
    expect(CharClass.NonWord).toBe(1)
    expect(CharClass.Delimiter).toBe(2)
    expect(CharClass.Lower).toBe(3)
    expect(CharClass.Upper).toBe(4)
    expect(CharClass.Letter).toBe(5)
    expect(CharClass.Number).toBe(6)
  })

  test('exactly seven classes', () => {
    expect(Object.keys(CharClass)).toHaveLength(7)
  })
})
