import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Violation } from '../models/violation.js'
import { MonorepoService } from '../services/monorepo.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-monorepo-scopes-match-known.js'

const prLayer = (title: string, scopes: string[]) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: Option.some(
      new CC.Commit.Single({
        type: CC.Type.parse('feat'),
        scopes,
        breaking: false,
        message: 'do things',
        body: Option.none(),
        footers: [],
      }),
    ),
    titleParseError: Option.none(),
  })

const monorepoLayer = (validScopes: string[]) =>
  Layer.succeed(MonorepoService, { packages: [], validScopes })

describe('pr.monorepo.scopes.match-known', () => {
  test('passes when all scopes are known', async () => {
    const result = await Effect.runPromise(
      rule
        .check()
        .pipe(
          Effect.provide(
            Layer.mergeAll(
              prLayer('feat(core): do things', ['core']),
              monorepoLayer(['core', 'cli']),
            ),
          ),
        ),
    )

    expect(result).toBeUndefined()
  })

  test('violation names the unknown scopes and the known ones', async () => {
    const result = await Effect.runPromise(
      rule
        .check()
        .pipe(
          Effect.provide(
            Layer.mergeAll(
              prLayer('feat(nope): do things', ['nope']),
              monorepoLayer(['core', 'cli']),
            ),
          ),
        ),
    )

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected a violation')

    expect(result.location._tag).toBe('ViolationLocationPrTitle')
    expect(result.summary).toBe('Scope(s) "nope" are not known monorepo packages.')
    expect(result.detail).toBe('Known scopes: core, cli.')
  })

  test('returns the invalid-title violation when the PR title is not parseable', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(PrService, {
              number: 129,
              title: 'bad title',
              body: '',
              commit: Option.none(),
              titleParseError: Option.some('Missing colon separator: "bad title"'),
            }),
            monorepoLayer(['core']),
          ),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected a violation')
    expect(result.summary).toContain('not a valid conventional commit title')
    expect(result.detail).toBe('Missing colon separator: "bad title"')
  })
})
