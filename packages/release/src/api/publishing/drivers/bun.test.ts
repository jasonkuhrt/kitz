import { describe, expect, test } from 'bun:test'
import { Bun } from '../providers/__.js'

describe('Bun publishing provider command construction', () => {
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
      }),
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

    expect(result._tag).toBe('Unsupported')
    if (result._tag === 'Unsupported') {
      expect(result.reason).toBe('not-supported-by-provider')
    }
  })
})
