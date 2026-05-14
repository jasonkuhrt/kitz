import { describe, expect, test } from 'bun:test'
import { Pnpm } from '../providers/__.js'

describe('pnpm publishing provider command construction', () => {
  test('covers native publish flags required by the product matrix', () => {
    expect(
      Pnpm.buildPublishCommand({
        target: './dist/kitz-core-1.0.0.tgz',
        tag: 'next',
        registry: 'https://registry.npmjs.org/',
        access: 'public',
        otp: '123456',
        provenance: true,
        dryRun: true,
        json: true,
        reportSummary: true,
        noGitChecks: true,
      }),
    ).toEqual([
      'pnpm',
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
      '--provenance',
      '--dry-run',
      '--json',
      '--report-summary',
      '--no-git-checks',
    ])
  })
})
