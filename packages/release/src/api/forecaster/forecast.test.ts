import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option, Result } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Analysis, CascadeImpact, Impact, makeCascadeCommit } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import type { Recon } from '../explorer/models/__.js'
import { forecast, type ReconWithGithubTarget } from './forecast.js'

const corePackage: Package = {
  scope: 'core',
  name: Pkg.Moniker.parse('@kitz/core'),
  path: Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
}

const cliPackage: Package = {
  scope: 'cli',
  name: Pkg.Moniker.parse('@kitz/cli'),
  path: Fs.Path.AbsDir.fromString('/repo/packages/cli/'),
}

const recon: ReconWithGithubTarget = {
  ci: { detected: false, provider: null, prNumber: null },
  github: {
    target: {
      owner: 'org',
      repo: 'repo',
      source: 'git:origin',
    },
    credentials: null,
  },
  npm: {
    authenticated: false,
    username: null,
    registry: null,
  },
  git: {
    root: Fs.Path.AbsDir.fromString('/repo/'),
    clean: true,
    branch: 'main',
    headSha: 'abc1234',
    remotes: {},
  },
}

const analysisFor = (packages: { impact: Package; cascade: Package }) =>
  Analysis.make({
    impacts: [
      Impact.make({
        package: packages.impact,
        bump: 'minor',
        commits: [makeCascadeCommit(packages.impact.scope, 'feature')],
        currentVersion: Option.some(Semver.fromString('1.0.0')),
      }),
    ],
    cascades: [
      CascadeImpact.make({
        package: packages.cascade,
        currentVersion: Option.some(Semver.fromString('2.0.0')),
        triggeredBy: [packages.impact],
      }),
    ],
    unchanged: [],
    tags: [],
  })

describe('forecast', () => {
  test('uses resolved package locations for source URLs across custom layouts', () => {
    const result = Result.getOrThrow(
      forecast(analysisFor({ impact: corePackage, cascade: cliPackage }), recon),
    )

    expect(result.releases[0]!.sourceUrl).toBe(
      'https://github.com/org/repo/tree/main/tooling/pkg-core',
    )
    expect(result.cascades[0]!.sourceUrl).toBe('https://github.com/org/repo/tree/main/packages/cli')
  })

  test('a package path outside the repo root is a typed failure, not a crash', () => {
    const strayPackage: Package = {
      scope: 'stray',
      name: Pkg.Moniker.parse('@kitz/stray'),
      path: Fs.Path.AbsDir.fromString('/elsewhere/stray/'),
    }

    const result = forecast(analysisFor({ impact: strayPackage, cascade: cliPackage }), recon)

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('PackageLocationError')
      expect(result.failure.context.problem).toBe('outside-root')
    }
  })

  test('a recon without a proven GitHub target is rejected at compile time', () => {
    const targetlessRecon: Recon = {
      ...recon,
      github: { target: null, credentials: null },
    }

    // Type-level regression for the former `recon.github.target!` crash: a
    // plain Recon (target possibly null) must not be accepted. Never invoked.
    const rejected = () =>
      // @ts-expect-error Recon with a nullable target must be narrowed before forecasting.
      forecast(analysisFor({ impact: corePackage, cascade: cliPackage }), targetlessRecon)
    void rejected

    expect(targetlessRecon.github.target).toBeNull()
  })
})
