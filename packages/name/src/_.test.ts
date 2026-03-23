import { describe, expect, test } from 'vitest'
import * as NameModule from './_.js'
import { generate } from './name.js'

describe('name', () => {
  test('exports the Name namespace', () => {
    expect(NameModule.Name.generate).toBe(generate)
  })

  test('generates a three-part display name', () => {
    const generated = generate()
    const parts = generated.split(' ')

    expect(parts).toHaveLength(3)
    expect(parts.every((part) => part.length > 0)).toBe(true)
    expect(generated.trim()).toBe(generated)
    expect(generated.match(/ /g)).toHaveLength(2)
    expect(generated).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][A-Za-z]+$/)
  })
})
