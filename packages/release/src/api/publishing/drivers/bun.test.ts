import { describe, expect, test } from 'bun:test'
import * as Capability from '../models/capability.js'
import { Bun } from '../providers/__.js'

describe('Bun publishing provider command construction', () => {
  test('covers pack command shape with and without an explicit destination', () => {
    expect(Bun.buildPackCommand().argv).toEqual(['bun', 'pm', 'pack'])
    expect(Bun.buildPackCommand({ destination: '/repo/.release/artifacts/' }).argv).toEqual([
      'bun',
      'pm',
      'pack',
      '--destination',
      '/repo/.release/artifacts/',
    ])
  })

  test('covers publish flags required by the product matrix', () => {
    expect(
      Bun.buildPublishCommand({
        target: './dist/kitz-core-1.0.0.tgz',
        tag: 'next',
        registry: 'https://registry.npmjs.org/',
        access: 'public',
        otp: '123456',
        authType: 'legacy',
        dryRun: true,
        tolerateRepublish: true,
      }).argv,
    ).toEqual([
      'bun',
      'publish',
      './dist/kitz-core-1.0.0.tgz',
      '--tag',
      'next',
      '--registry',
      'https://registry.npmjs.org/',
      '--access',
      'public',
      '--otp',
      '123456',
      '--auth-type',
      'legacy',
      '--dry-run',
      '--tolerate-republish',
    ])
  })

  test('models missing ignore-scripts support as typed unsupported capability data', () => {
    const result = Bun.capabilityResult('publish:ignore-scripts')

    expect(result.isSupported).toBe(false)
    expect(Capability.Unsupported.is(result)).toBe(true)
    if (Capability.Unsupported.is(result)) {
      expect(result.reason).toBe('not-supported-by-provider')
    }
  })
})
