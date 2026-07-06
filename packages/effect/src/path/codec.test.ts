import { describe, expect, it } from 'vite-plus/test'
import { Equal, Schema as S } from 'effect'
import { FastCheck } from 'effect/testing'
import * as Path from './__.js'
import './test-matchers.setup.js'

const codecCases = [
  ['AbsDir', Path.AbsDir, Path.Testing.AbsDir],
  ['AbsFile', Path.AbsFile, Path.Testing.AbsFile],
  ['RelDir', Path.RelDir, Path.Testing.RelDir],
  ['RelFile', Path.RelFile, Path.Testing.RelFile],
  ['Abs', Path.Abs, FastCheck.oneof(Path.Testing.AbsDir, Path.Testing.AbsFile)],
  ['Rel', Path.Rel, FastCheck.oneof(Path.Testing.RelDir, Path.Testing.RelFile)],
  ['Dir', Path.Dir, FastCheck.oneof(Path.Testing.AbsDir, Path.Testing.RelDir)],
  ['File', Path.File, FastCheck.oneof(Path.Testing.AbsFile, Path.Testing.RelFile)],
  ['Any', Path.Any, Path.Testing.Any],
] as const

const canonicalizationCases = [
  ['a/../b', 'RelFile', './b'],
  ['./x/./y/', 'RelDir', './x/y/'],
  ['//', 'AbsDir', '/'],
  ['.', 'RelDir', './'],
  ['..', 'RelDir', '../'],
  ['', 'RelDir', './'],
  ['./.env.local', 'RelFile', './.env.local'],
  ['/a/b', 'AbsFile', '/a/b'],
  ['x.', 'RelDir', './x./'],
  ['./.gitignore', 'RelFile', './.gitignore'],
] as const

const unionVariantCases = [
  ...canonicalizationCases,
  ['/', 'AbsDir', '/'],
  ['/a/b/', 'AbsDir', '/a/b/'],
  ['/releases/v1.2', 'AbsFile', '/releases/v1.2'],
  ['/etc/hostname', 'AbsFile', '/etc/hostname'],
  ['/u/.gitignore', 'AbsFile', '/u/.gitignore'],
  ['./', 'RelDir', './'],
  ['../', 'RelDir', '../'],
  ['../x', 'RelFile', '../x'],
  ['../x/', 'RelDir', '../x/'],
  ['./x', 'RelFile', './x'],
  ['./x/', 'RelDir', './x/'],
] as const

describe('Path codecs', () => {
  it.each(codecCases)('%s decode(encode(value)) is identity', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)
    const decode = S.decodeSync(schema)

    FastCheck.assert(
      FastCheck.property(arbitrary as FastCheck.Arbitrary<never>, (path) => {
        expect(decode(encode(path))).toEqual(path)
      }),
    )
  })

  it.each(codecCases)('%s encode(decode(canonical)) is idempotent', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)
    const decode = S.decodeSync(schema)

    FastCheck.assert(
      FastCheck.property(arbitrary as FastCheck.Arbitrary<never>, (path) => {
        const canonical = encode(path)
        expect(encode(decode(canonical))).toBe(canonical)
      }),
    )
  })

  it.each(canonicalizationCases)('%s canonicalizes as %s %s', (input, tag, canonical) => {
    const path = S.decodeSync(Path.Any)(input)
    expect(path._tag).toBe(tag)
    expect(path).toEncodeTo(canonical)
    expect(S.encodeSync(Path.Any)(S.decodeSync(Path.Any)(canonical))).toBe(canonical)
  })

  it.each(unionVariantCases)('Any decodes %s as %s', (input, tag, canonical) => {
    const path = S.decodeSync(Path.Any)(input)
    expect(path._tag).toBe(tag)
    expect(path).toEncodeTo(canonical)
  })

  it.each(codecCases)('%s Equal agrees with canonical encoding', (_, schema, arbitrary) => {
    const encode = S.encodeSync(schema)

    FastCheck.assert(
      FastCheck.property(
        arbitrary as FastCheck.Arbitrary<never>,
        arbitrary as FastCheck.Arbitrary<never>,
        (a, b) => {
          expect(Equal.equals(a, b)).toBe(encode(a) === encode(b))
        },
      ),
    )
  })

  it('explicit directory targets accept extension-looking names without trailing slash', () => {
    const dir = S.decodeSync(Path.AbsDir)('/releases/v1.2')

    expect(dir).toBeAbs()
    expect(dir).toBeDir()
    expect(dir).toEncodeTo('/releases/v1.2/')
  })

  it('explicit file targets accept extensionless files and dotfiles', () => {
    const hostname = S.decodeSync(Path.AbsFile)('/etc/hostname')
    const dotfile = S.decodeSync(Path.AbsFile)('/u/.gitignore')
    const env = S.decodeSync(Path.RelFile)('./.env.local')

    expect(hostname).toBeAbs()
    expect(hostname).toBeFile()
    expect(hostname).toEncodeTo('/etc/hostname')
    expect(dotfile).toEncodeTo('/u/.gitignore')
    expect(env).toBeRel()
    expect(env).toEncodeTo('./.env.local')
  })
})
