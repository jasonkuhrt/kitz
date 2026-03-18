import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Analysis, CascadeImpact, Impact, makeCascadeCommit } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import type { Recon } from '../explorer/models/__.js'
import { forecast } from './forecast.js'

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

const recon: Recon = {
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

describe('forecast', () => {
  test('uses resolved package locations for source URLs across custom layouts', () => {
    const result = forecast(
      Analysis.make({
        impacts: [
          Impact.make({
            package: corePackage,
            bump: 'minor',
            commits: [makeCascadeCommit('core', 'feature')],
            currentVersion: Option.some(Semver.fromString('1.0.0')),
          }),
        ],
        cascades: [
          CascadeImpact.make({
            package: cliPackage,
            currentVersion: Option.some(Semver.fromString('2.0.0')),
            triggeredBy: [corePackage],
          }),
        ],
        unchanged: [],
        tags: [],
      }),
      recon,
    )

    expect(result.releases[0]!.sourceUrl).toBe(
      'https://github.com/org/repo/tree/main/tooling/pkg-core',
    )
    expect(result.cascades[0]!.sourceUrl).toBe('https://github.com/org/repo/tree/main/packages/cli')
  })
})
