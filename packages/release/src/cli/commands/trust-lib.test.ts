import { describe, expect, test } from 'bun:test'
import {
  renderTrustCircleciCommand,
  renderTrustGithubCommand,
  renderTrustGitlabCommand,
  renderTrustListCommand,
} from './trust-lib.js'

describe('trust-lib command rendering', () => {
  test('renders the list command with and without optional params', () => {
    expect(
      renderTrustListCommand({ packageName: undefined, registry: undefined, json: false }),
    ).toBe('npm trust list')
    expect(
      renderTrustListCommand({
        packageName: '@kitz/core',
        registry: 'https://registry.example.com',
        json: true,
      }),
    ).toBe('npm trust list @kitz/core --registry https://registry.example.com --json')
  })

  test('renders the github setup command', () => {
    expect(
      renderTrustGithubCommand({
        packageName: '@kitz/core',
        repository: 'jasonkuhrt/kitz',
        workflowFile: 'release.yml',
        environment: undefined,
        registry: undefined,
        yes: false,
        dryRun: true,
      }),
    ).toBe('npm trust github @kitz/core --repository jasonkuhrt/kitz --file release.yml --dry-run')
  })

  test('renders the gitlab setup command with environment and registry', () => {
    expect(
      renderTrustGitlabCommand({
        packageName: '@kitz/core',
        project: 'group/project',
        workflowFile: '.gitlab-ci.yml',
        environment: 'production',
        registry: 'https://registry.example.com',
        yes: true,
        dryRun: false,
      }),
    ).toBe(
      'npm trust gitlab @kitz/core --project group/project --file .gitlab-ci.yml --environment production --registry https://registry.example.com --yes',
    )
  })

  test('renders the circleci setup command with all required ids', () => {
    expect(
      renderTrustCircleciCommand({
        packageName: '@kitz/core',
        orgId: 'org-1',
        projectId: 'project-1',
        pipelineDefinitionId: 'pipeline-1',
        vcsOrigin: 'github.com/jasonkuhrt/kitz',
        environment: undefined,
        registry: undefined,
        yes: false,
        dryRun: false,
      }),
    ).toBe(
      'npm trust circleci @kitz/core --org-id org-1 --project-id project-1 --pipeline-definition-id pipeline-1 --vcs-origin github.com/jasonkuhrt/kitz',
    )
  })
})
