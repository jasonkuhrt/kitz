import { Option, Schema as S } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Descriptor } from './Descriptor.js'

const decode = S.decodeUnknownOption(Descriptor.FromString)
const encode = S.encodeSync(Descriptor.FromString)

describe('Pkg.Manager.Descriptor', () => {
  test('parses a simple descriptor', () => {
    const descriptor = Descriptor.fromString('pnpm@10.7.0')

    expect(descriptor.name.moniker).toBe('pnpm')
    expect(Option.isSome(descriptor.version)).toBe(true)
    expect(descriptor.version._tag === 'Some' && descriptor.version.value).toBe('10.7.0')
  })

  test('parses a scoped-name descriptor using the last @ as separator', () => {
    const descriptor = Descriptor.fromString('@scope/manager@1.2.3')

    expect(descriptor.name.moniker).toBe('@scope/manager')
    expect(descriptor.version._tag === 'Some' && descriptor.version.value).toBe('1.2.3')
  })

  test('preserves corepack hash suffixes in the version', () => {
    const descriptor = Descriptor.fromString('yarn@3.2.3+sha224.953c8233f7a92884eee2de69a1b92d1f')

    expect(descriptor.name.moniker).toBe('yarn')
    expect(descriptor.version._tag === 'Some' && descriptor.version.value).toBe(
      '3.2.3+sha224.953c8233f7a92884eee2de69a1b92d1f',
    )
  })

  test('treats a bare name as having no version', () => {
    expect(Option.isNone(Descriptor.fromString('bun').version)).toBe(true)
    expect(Option.isNone(Descriptor.fromString('@scope/manager').version)).toBe(true)
    expect(Descriptor.fromString('@scope/manager').name.moniker).toBe('@scope/manager')
  })

  test('rejects malformed descriptors via schema issues', () => {
    expect(Option.isNone(decode(''))).toBe(true)
    expect(Option.isNone(decode('pnpm@'))).toBe(true)
    expect(Option.isNone(decode('@scope/manager@'))).toBe(true)
    expect(Option.isNone(decode('@10.7.0'))).toBe(true)
    expect(Option.isNone(decode('@scope'))).toBe(true)
    expect(() => Descriptor.fromString('pnpm@')).toThrow('Invalid package-manager descriptor')
    expect(() => Descriptor.fromString('@10.7.0')).toThrow('Invalid package-manager name')
  })

  test('roundtrips encode after decode', () => {
    const inputs = [
      'pnpm@10.7.0',
      '@scope/manager@1.2.3',
      'bun',
      '@scope/manager',
      'yarn@3.2.3+sha224.abc',
    ]
    for (const input of inputs) {
      expect(encode(Descriptor.fromString(input))).toBe(input)
    }
  })
})
