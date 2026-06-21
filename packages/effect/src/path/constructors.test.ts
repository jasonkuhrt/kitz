import { describe, expect, it, test } from '@kitz/vitest'
import { Path } from './_.js'

// Explicit constructors correctly handle ambiguous dotfiles via hints

describe('RelFile.fromString with dotfiles', () => {
  it("fromString('./.gitignore')", () => {
    const result = Path.RelFile.fromString('./.gitignore')
    expect(Path.RelFile.is(result)).toBe(true)
  })

  it("fromString('./.env')", () => {
    const result = Path.RelFile.fromString('./.env')
    expect(Path.RelFile.is(result)).toBe(true)
  })

  it("fromString('./.dockerignore')", () => {
    const result = Path.RelFile.fromString('./.dockerignore')
    expect(Path.RelFile.is(result)).toBe(true)
  })
})

describe('AbsFile.fromString with dotfiles', () => {
  it("fromString('/etc/hosts')", () => {
    const result = Path.AbsFile.fromString('/etc/hosts')
    expect(Path.AbsFile.is(result)).toBe(true)
  })

  it("fromString('/.gitignore')", () => {
    const result = Path.AbsFile.fromString('/.gitignore')
    expect(Path.AbsFile.is(result)).toBe(true)
  })

  it("fromString('/.env')", () => {
    const result = Path.AbsFile.fromString('/.env')
    expect(Path.AbsFile.is(result)).toBe(true)
  })
})

// Verify .toString() roundtrips correctly for dotfiles
test('RelFile.fromString dotfile roundtrip', () => {
  const path = Path.RelFile.fromString('./.gitignore')
  expect(path.toString()).toBe('./.gitignore')
})

test('AbsFile.fromString dotfile roundtrip', () => {
  const path = Path.AbsFile.fromString('/etc/hosts')
  expect(path.toString()).toBe('/etc/hosts')
})
