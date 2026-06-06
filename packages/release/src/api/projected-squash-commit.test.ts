import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Github } from '@kitz/github'
import { Pkg } from '@kitz/pkg'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Impact } from './analyzer/models/impact.js'
import {
  applyPrTitle,
  collectScopeImpacts,
  preview,
  renderHeader,
} from './projected-squash-commit.js'

const pullRequestFixture = (title: string) =>
  ({
    number: 129,
    html_url: 'https://github.com/org/repo/pull/129',
    title,
    body: null,
    base: { ref: 'main' },
    head: { ref: 'feature/x' },
  }) satisfies Github.PullRequest

const githubContextFixture = (pullRequest: Github.PullRequest) => ({
  branch: 'feature/x',
  explicitPrNumber: 129,
  target: { owner: 'org', repo: 'repo', source: 'env:GITHUB_REPOSITORY' as const },
  token: 'token',
  pullRequest,
})

const makeImpact = (scope: string, bump: 'major' | 'minor' | 'patch') =>
  Impact.make({
    package: {
      scope,
      name: Pkg.Moniker.parse(`@kitz/${scope}`),
      path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
    },
    bump,
    commits: [],
    currentVersion: Option.none(),
  })

describe('projected squash commit', () => {
  test('renders a canonical release header from primary impacts', () => {
    const result = renderHeader({
      impacts: [
        { scope: 'cli', bump: 'patch' },
        { scope: 'core', bump: 'patch' },
        { scope: 'release', bump: 'major' },
      ],
    })

    expect(result).toBe('feat(release)!, fix(cli, core)')
  })

  test('compares the actual PR title header against the projected release header', () => {
    const result = preview({
      actualTitle: 'feat(cli, core)!, feat(release): add @kitz/release package',
      impacts: [
        { scope: 'cli', bump: 'major' },
        { scope: 'core', bump: 'major' },
        { scope: 'release', bump: 'minor' },
      ],
    })

    expect(result.projectedHeader).toBe('feat(cli, core)!, feat(release)')
    expect(result.actualHeader).toBe('feat(cli, core)!, feat(release)')
    expect(result.inSync).toBe(true)
  })

  test('collects unique scope impacts and keeps the highest bump per scope', () => {
    const result = collectScopeImpacts(
      {
        impacts: [
          makeImpact('release', 'patch'),
          makeImpact('cli', 'patch'),
          makeImpact('release', 'minor'),
          makeImpact('cli', 'major'),
          makeImpact('core', 'minor'),
        ],
      },
      { scopes: ['release', 'cli'] },
    )

    expect(result).toEqual([
      { scope: 'cli', bump: 'major' },
      { scope: 'release', bump: 'minor' },
    ])
  })

  test('returns null when there is no projected header to render', () => {
    expect(renderHeader({ impacts: [] })).toBeNull()
  })

  test('returns a reason when there are no primary impacts', () => {
    const result = preview({
      actualTitle: 'feat(release): polish',
      impacts: [],
    })

    expect(result.projectedHeader).toBeNull()
    expect(result.reason).toContain('No primary release impacts')
  })

  test('captures parse errors for invalid current PR titles', () => {
    const result = preview({
      actualTitle: 'bad title',
      impacts: [{ scope: 'release', bump: 'minor' }],
    })

    expect(result.projectedHeader).toBe('feat(release)')
    expect(result.actualHeader).toBeNull()
    expect(result.actualTitleError).toContain('Missing colon separator')
    expect(result.inSync).toBe(false)
  })

  test('primaryOnly excludes patch-only scopes when feat-level scopes exist', () => {
    const result = collectScopeImpacts(
      {
        impacts: [
          makeImpact('cmx', 'minor'),
          makeImpact('fuzzy', 'minor'),
          makeImpact('cli', 'patch'),
          makeImpact('github', 'patch'),
          makeImpact('kitz', 'patch'),
        ],
      },
      { primaryOnly: true },
    )

    expect(result).toEqual([
      { scope: 'cmx', bump: 'minor' },
      { scope: 'fuzzy', bump: 'minor' },
    ])
  })

  test('primaryOnly returns all scopes when only patch-level impacts exist', () => {
    const result = collectScopeImpacts(
      {
        impacts: [
          makeImpact('cli', 'patch'),
          makeImpact('github', 'patch'),
          makeImpact('kitz', 'patch'),
        ],
      },
      { primaryOnly: true },
    )

    expect(result).toEqual([
      { scope: 'cli', bump: 'patch' },
      { scope: 'github', bump: 'patch' },
      { scope: 'kitz', bump: 'patch' },
    ])
  })

  test('primaryOnly includes major-level scopes alongside minor-level scopes', () => {
    const result = collectScopeImpacts(
      {
        impacts: [
          makeImpact('core', 'major'),
          makeImpact('cmx', 'minor'),
          makeImpact('cli', 'patch'),
        ],
      },
      { primaryOnly: true },
    )

    expect(result).toEqual([
      { scope: 'cmx', bump: 'minor' },
      { scope: 'core', bump: 'major' },
    ])
  })

  test('primaryOnly=false (default) returns all scopes regardless of bump level', () => {
    const result = collectScopeImpacts({
      impacts: [makeImpact('cmx', 'minor'), makeImpact('cli', 'patch')],
    })

    expect(result).toEqual([
      { scope: 'cli', bump: 'patch' },
      { scope: 'cmx', bump: 'minor' },
    ])
  })

  test('treats an empty title as already in sync when there are no impacts', () => {
    const result = preview({
      actualTitle: '   ',
      impacts: [],
    })

    expect(result.actualTitle).toBe('')
    expect(result.projectedHeader).toBeNull()
    expect(result.inSync).toBe(true)
  })
})

describe('applyPrTitle', () => {
  test('returns changed: false when the PR title already carries the canonical header', async () => {
    const pullRequest = pullRequestFixture('feat(core): already canonical')
    const result = await Effect.runPromise(
      applyPrTitle({
        pullRequest,
        projectedHeader: 'feat(core)',
        githubContext: githubContextFixture(pullRequest),
      }).pipe(Effect.provide(Env.Test({ vars: {} }))),
    )

    expect(result.changed).toBe(false)
    expect(result.after).toBe('feat(core): already canonical')
  })

  test('rewrites only the header and updates the PR via the injected Github service', async () => {
    const pullRequest = pullRequestFixture('feat: legacy subject')
    // GitHub injected as a memory double — no live fetch, no network. result.after
    // is the title returned by the double's updatePullRequest, proving the update
    // was routed through the injected service.
    const { layer } = await Effect.runPromise(
      Github.Memory.makeWithState({ pullRequests: [pullRequest] }),
    )
    const result = await Effect.runPromise(
      applyPrTitle({
        pullRequest,
        projectedHeader: 'feat(core)',
        githubContext: githubContextFixture(pullRequest),
        githubLayer: layer,
      }).pipe(Effect.provide(Env.Test({ vars: { GITHUB_TOKEN: 'token' } }))),
    )

    expect(result.changed).toBe(true)
    expect(result.before).toBe('feat: legacy subject')
    expect(result.after).toBe('feat(core): legacy subject')
  })
})
