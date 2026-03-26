import { ReleaseCommit } from '../analyzer/models/commit.js'
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { renderExplanation } from './explain.js'

const makeCommit = (message: string) =>
  ReleaseCommit.make({
    hash: Git.Sha.make('abc1234'),
    author: Git.Author.make({ name: 'Jason', email: 'jason@example.com' }),
    date: new Date('2026-03-18T12:00:00Z'),
    message: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.parse('feat'),
      scopes: ['core'],
      breaking: false,
      message: message.replace(/^feat\(core\): /u, ''),
      body: Option.none(),
      footers: [],
    }),
  })

describe('renderExplanation', () => {
  test('renders primary explanations with commit detail', () => {
    const output = renderExplanation({
      decision: 'primary',
      requestedPackage: 'core',
      package: {
        name: '@kitz/core',
        scope: 'core',
        path: '/repo/packages/core/',
      },
      currentVersion: '1.0.0',
      nextOfficialVersion: '1.1.0',
      bump: 'minor',
      commits: [makeCommit('feat(core): add explain command')],
    })

    expect(output).toContain('Outcome: primary')
    expect(output).toContain('Next official version: 1.1.0')
    expect(output).toContain('1 unreleased scoped commit matched "core".')
    expect(output).toContain('abc1234 feat: add explain command')
  })

  test('renders cascade explanations with dependency paths', () => {
    const output = renderExplanation({
      decision: 'cascade',
      requestedPackage: '@kitz/app',
      package: {
        name: '@kitz/app',
        scope: 'app',
        path: '/repo/packages/app/',
      },
      currentVersion: '3.0.0',
      nextOfficialVersion: '3.0.1',
      bump: 'patch',
      triggeredBy: [{ name: '@kitz/core', scope: 'core', path: '/repo/packages/core/' }],
      dependencyPaths: [
        {
          packages: [
            { name: '@kitz/core', scope: 'core', path: '/repo/packages/core/' },
            { name: '@kitz/cli', scope: 'cli', path: '/repo/packages/cli/' },
            { name: '@kitz/app', scope: 'app', path: '/repo/packages/app/' },
          ],
        },
      ],
    })

    expect(output).toContain('Outcome: cascade')
    expect(output).toContain('Triggered by:')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('@kitz/core -> @kitz/cli -> @kitz/app')
  })

  test('renders unchanged explanations', () => {
    const output = renderExplanation({
      decision: 'unchanged',
      requestedPackage: 'docs',
      package: {
        name: '@kitz/docs',
        scope: 'docs',
        path: '/repo/packages/docs/',
      },
      currentVersion: '4.0.0',
      nextOfficialVersion: null,
    })

    expect(output).toContain('Outcome: unchanged')
    expect(output).toContain('Current version: 4.0.0')
    expect(output).toContain('no runtime dependency release path reaches this package')
  })

  test('renders missing package explanations', () => {
    const output = renderExplanation({
      decision: 'missing',
      requestedPackage: 'missing',
      availablePackages: ['@kitz/core', 'core'],
    })

    expect(output).toContain('Package "missing" was not found in the workspace.')
    expect(output).toContain('Available package identifiers:')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('core')
  })
})
