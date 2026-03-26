import { Schema as S } from 'effect'
import { describe, expect, test } from 'vitest'
import * as ColorModule from './__.js'
import { hexToRgb, hslToRgb } from './conversions.js'
import { namedColors } from './named-colors.js'
import { parse } from './parser.js'
import { Color, ColorInput } from './schema.js'

describe('color', () => {
  test('exports conversions and named colors', () => {
    expect(ColorModule.hexToRgb).toBe(hexToRgb)
    expect(ColorModule.parse).toBe(parse)
    expect(namedColors.red).toEqual({ r: 255, g: 0, b: 0 })
    expect(namedColors.blueviolet).toEqual({ r: 138, g: 43, b: 226 })
  })

  test('converts hex and hsl inputs to rgb', () => {
    expect(hexToRgb('#FF5733')).toEqual({ r: 255, g: 87, b: 51 })
    expect(hexToRgb('336699')).toEqual({ r: 51, g: 102, b: 153 })
    expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 })
    expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 })
    expect(hslToRgb(180, 100, 50)).toEqual({ r: 0, g: 255, b: 255 })
    expect(hslToRgb(360, 100, 50)).toEqual({ r: 255, g: 0, b: 0 })
    expect(hslToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 })
    expect(hslToRgb(0, 100, 75)).toEqual({ r: 255, g: 128, b: 128 })
  })

  test('parses supported runtime color formats', () => {
    expect(parse({ r: 1, g: 2, b: 3 })).toEqual({ r: 1, g: 2, b: 3 })
    expect(parse('#FF5733')).toEqual({ r: 255, g: 87, b: 51 })
    expect(parse('FF5733')).toEqual({ r: 255, g: 87, b: 51 })
    expect(parse('rgb 255 87 51')).toEqual({ r: 255, g: 87, b: 51 })
    expect(parse('rgb 500 87 51')).toBe(null)
    expect(parse('rgb(255, 87, 51)')).toEqual({ r: 255, g: 87, b: 51 })
    expect(parse('rgb(500, 87, 51)')).toBe(null)
    expect(parse('hsl 240 100 50')).toEqual({ r: 0, g: 0, b: 255 })
    expect(parse('hsl(120, 100, 50)')).toEqual({ r: 0, g: 255, b: 0 })
    expect(parse('  ReD  ')).toEqual(namedColors.red)
    expect(parse('not-a-color')).toBe(null)
  })

  test('validates and encodes branded colors with effect schema', () => {
    const fromString = Color.fromString('red')
    const fromRgb = Color.fromRgb({ r: 12, g: 34, b: 56 })
    const decodedFromObject = S.decodeSync(ColorInput)({ r: 1, g: 2, b: 3 })
    const decodedFromString = S.decodeSync(ColorInput)('#00FF00')

    expect(Color.is(fromString)).toBe(true)
    expect(fromString.toHex()).toBe('#FF0000')
    expect(fromString.toString()).toBe('#FF0000')
    expect(fromRgb.toHex()).toBe('#0C2238')
    expect(S.encodeSync(Color.String)(fromRgb)).toBe('#0C2238')
    expect(decodedFromObject).toEqual(Color.make({ r: 1, g: 2, b: 3 }))
    expect(decodedFromString).toEqual(Color.make({ r: 0, g: 255, b: 0 }))
    expect(() => Color.fromString('invalid')).toThrow(/Invalid color format/)
  })
})
