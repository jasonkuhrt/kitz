import { Semver } from '@kitz/semver'
import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { encodeForecastEnvelope, ForecastEnvelopeJson } from './envelope.js'
import { CommitDisplay, Forecast, ForecastRelease } from './models.js'

const forecast = Forecast.make({
  owner: 'org',
  repo: 'repo',
  branch: 'main',
  headSha: 'abc1234',
  releases: [
    ForecastRelease.make({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      currentVersion: Option.some(Semver.fromString('1.0.0')),
      nextOfficialVersion: Semver.fromString('1.1.0'),
      commits: [
        CommitDisplay.make({
          shortSha: 'abc1234',
          subject: 'add feature',
          type: 'feat',
          breaking: false,
          commitUrl: 'https://github.com/org/repo/commit/abc1234',
        }),
      ],
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
    }),
  ],
  cascades: [],
})

describe('ForecastEnvelopeJson', () => {
  test('encodes and decodes enriched forecast JSON', () => {
    const json = encodeForecastEnvelope({
      forecast,
      publishState: 'published',
      publishHistory: [
        {
          package: '@kitz/core',
          version: '1.1.0',
          iteration: 1,
          sha: 'abc1234',
          timestamp: '2026-01-01T00:00:00Z',
          runId: 'run-1',
        },
      ],
    })

    const decoded = Schema.decodeSync(ForecastEnvelopeJson)(json)

    expect(decoded.forecast.headSha).toBe('abc1234')
    expect(decoded.publishState).toBe('published')
    expect(decoded.publishHistory).toHaveLength(1)
  })
})
