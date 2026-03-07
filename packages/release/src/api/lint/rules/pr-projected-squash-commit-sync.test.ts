import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { PrTitle } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-projected-squash-commit-sync.js'

const makePrLayer = (title: string, parseError?: string) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: parseError
      ? Option.none()
      : Option.some(
          Effect.runSync(
            CC.Title.parse(title).pipe(
              Effect.orElseFail(
                () => new Error(`expected valid conventional commit title: ${title}`),
              ),
            ),
          ),
        ),
    titleParseError: parseError ? Option.some(parseError) : Option.none(),
  })

describe('pr.projected-squash-commit-sync', () => {
  test('passes when the PR title header already matches the canonical release header', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('feat(core): release 1 packages')),
        Effect.provideService(RuleOptionsService, {
          projectedHeader: 'feat(core)',
        }),
      ),
    )

    expect(result).toEqual({
      metadata: {
        projectedHeader: 'feat(core)',
      },
    })
  })

  test('warns when the PR title header differs from the canonical release header', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('feat(release): polish')),
        Effect.provideService(RuleOptionsService, {
          projectedHeader: 'feat(cli, core)',
        }),
      ),
    )

    expect(result).toBeDefined()
    if (!result || !('location' in result)) {
      throw new Error('expected a violation')
    }

    expect(PrTitle.is(result.location)).toBe(true)
    expect(result.summary).toContain('out of sync')
    expect(result.fix?._tag).toBe('ViolationCommandFix')
  })

  test('returns the invalid-title violation when the PR title is not parseable', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('bad title', 'Missing colon separator: "bad title"')),
        Effect.provideService(RuleOptionsService, {
          projectedHeader: 'feat(core)',
        }),
      ),
    )

    expect(result).toBeDefined()
    if (!result || !('location' in result)) {
      throw new Error('expected a violation')
    }

    expect(result.summary).toContain('not a valid conventional commit title')
  })
})
