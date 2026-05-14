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
        provenanceFile: '/repo/attestation.jsonl',
        dryRun: true,
        ignoreScripts: false,
      }),
    ).toEqual([
      'npm',
      'publish',
      '/repo/.release/artifacts/kitz-core-1.0.0.tgz',
      '--access',
      'public',
      '--tag',
      'next',
      '--registry',
      'https://registry.npmjs.org/',
      '--otp',
      '123456',
      '--provenance',
      '--provenance-file',
      '/repo/attestation.jsonl',
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

  test('covers GitLab and CircleCI trusted-publisher setup command shapes', () => {
    expect(
      Npm.buildTrustGitlabCommand({
        packageName: '@kitz/core',
        project: 'kitz/kitz',
        workflowFile: '.gitlab-ci.yml',
        environment: 'npm',
        registry: 'https://registry.npmjs.org/',
        yes: true,
      }),
    ).toEqual([
      'npm',
      'trust',
      'gitlab',
      '@kitz/core',
      '--project',
      'kitz/kitz',
      '--file',
      '.gitlab-ci.yml',
      '--environment',
      'npm',
      '--registry',
      'https://registry.npmjs.org/',
      '--yes',
    ])

    expect(
      Npm.buildTrustCircleciCommand({
        packageName: '@kitz/core',
        orgId: 'org-1',
        projectId: 'project-1',
        pipelineDefinitionId: 'pipeline-1',
        vcsOrigin: 'github.com/jasonkuhrt/kitz',
        contextIds: ['ctx-1', 'ctx-2'],
        dryRun: true,
      }),
    ).toEqual([
      'npm',
      'trust',
      'circleci',
      '@kitz/core',
      '--org-id',
      'org-1',
      '--project-id',
      'project-1',
      '--pipeline-definition-id',
      'pipeline-1',
      '--vcs-origin',
      'github.com/jasonkuhrt/kitz',
      '--context-id',
      'ctx-1',
      '--context-id',
      'ctx-2',
      '--dry-run',
    ])
  })

  test('exposes npm capability results as provider data', () => {
    expect(Npm.capabilityResult('publish:tarball')._tag).toBe('Supported')
    expect(Npm.capabilityResult('publish:tolerate-republish')._tag).toBe('Unsupported')
  })
})
