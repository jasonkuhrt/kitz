import { describe, expect, test } from 'bun:test'
import * as Capability from '../models/capability.js'
import { Pnpm } from '../providers/__.js'

describe('pnpm publishing provider command construction', () => {
  test('covers native pack flags required for artifact rehearsal', () => {
    expect(
      Pnpm.buildPackCommand({
        packDestination: './.release/artifacts',
        dryRun: true,
      }).argv,
    ).toEqual(['pnpm', 'pack', '--json', '--pack-destination', './.release/artifacts', '--dry-run'])
  })

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
      }).argv,
    ).toEqual([
      'pnpm',
      'publish',
      './dist/kitz-core-1.0.0.tgz',
      '--access',
      'public',
      '--no-git-checks',
      '--tag',
      'next',
      '--registry',
      'https://registry.npmjs.org/',
      '--otp',
      '123456',
      '--provenance',
      '--dry-run',
      '--json',
      '--report-summary',
    ])
  })

  test('exposes pnpm capability results as provider data', () => {
    expect(Pnpm.capabilityResult('publish:tarball').isSupported).toBe(true)
    expect(Capability.Unsupported.is(Pnpm.capabilityResult('publish:tolerate-republish'))).toBe(
      true,
    )
  })
})
