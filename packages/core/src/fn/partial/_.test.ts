import { describe, expect, test } from 'bun:test'
import { Partial } from './_.js'

describe('Fn.Partial namespace', () => {
  test('exports runtime functions', () => {
    expect(Partial._).toBeDefined()
    expect(Partial.partial).toBeDefined()
    expect(Partial.apply).toBeDefined()
    expect(Partial.defer).toBeDefined()
    expect(Partial.isHole).toBeDefined()
  })

  // test('exports generator functions', () => {
  //   expect(Partial.Generator).toBeDefined()
  //   expect(Partial.Generator.generate).toBeDefined()
  //   expect(Partial.Generator.generateForFile).toBeDefined()
  //   expect(Partial.Generator.createProjectFromProgram).toBeDefined()
  // })
})
