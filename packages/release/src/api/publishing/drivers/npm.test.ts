import { describe, expect, test } from 'bun:test'
import { Npm } from '../providers/__.js'

describe('npm publishing provider command construction', () => {
  test('covers pack and dry-run publish flags used by deterministic release', () => {
    expect(
      Npm.buildPackCommand({
        packDestination: '/repo/.release/artifacts/',
        dryRun: true,
      }),
    ).toEqual([
      'npm',
      'pack',
      '--json',
      '--pack-destination',
      '/repo/.release/artifacts/',
      '--dry-run',
    ])

    expect(
      Npm.buildPublishCommand({
        target: '/repo/.release/artifacts/kitz-core-1.0.0.tgz',
        tag: 'next',
        registry: 'https://registry.npmjs.org/',
        access: 'public',
        otp: '123456',
        provenance: true,
        dryRun: true,
      }),
    ).toEqual([
      'npm',
      'publish',
      '/repo/.release/artifacts/kitz-core-1.0.0.tgz',
      '--access',
      'public',
      '--ignore-scripts',
      '--tag',
      'next',
      '--registry',
      'https://registry.npmjs.org/',
      '--otp',
      '123456',
      '--provenance',
      '--dry-run',
    ])
  })

  test('covers trusted publisher read and GitHub setup command shapes', () => {
    expect(
      Npm.buildTrustListCommand({
        packageName: '@kitz/core',
        registry: 'https://registry.npmjs.org/',
        json: true,
      }),
    ).toEqual([
      'npm',
      'trust',
      'list',
      '@kitz/core',
      '--registry',
      'https://registry.npmjs.org/',
      '--json',
    ])

    expect(
      Npm.buildTrustGithubCommand({
        packageName: '@kitz/core',
        repository: 'jasonkuhrt/kitz',
        workflowFile: 'release.yml',
        environment: 'npm',
        yes: true,
        dryRun: true,
      }),
    ).toEqual([
      'npm',
      'trust',
      'github',
      '@kitz/core',
      '--repository',
      'jasonkuhrt/kitz',
      '--file',
      'release.yml',
      '--environment',
      'npm',
      '--yes',
      '--dry-run',
    ])
  })
})
