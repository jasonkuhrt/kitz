import { Test } from '@kitz/test'
import { expect, test } from 'vitest'
import { Path } from './_.js'

// Explicit constructors correctly handle ambiguous dotfiles via hints

Test.describe('RelFile.fromString with dotfiles').on(Path.RelFile.fromString)
  .casesInput('./.gitignore', './.env', './.dockerignore')
  .test(({ result }) => {
    expect(Path.RelFile.is(result)).toBe(true)
  })

Test.describe('AbsFile.fromString with dotfiles').on(Path.AbsFile.fromString)
  .casesInput('/etc/hosts', '/.gitignore', '/.env')
  .test(({ result }) => {
    expect(Path.AbsFile.is(result)).toBe(true)
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
