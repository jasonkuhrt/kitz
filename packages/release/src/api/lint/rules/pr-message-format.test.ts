import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { PrBody, PrTitle } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-message-format.js'

const makePrLayer = (title: string, body: string) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body,
    commit: Option.some(
      CC.Commit.Single.make({
        type: CC.Type.parse('feat'),
        scopes: ['release'],
        breaking: false,
        message: 'release polish',
        body: Option.none(),
        footers: [],
      }),
    ),
    titleParseError: Option.none(),
  })

describe('pr.message.format', () => {
  test('passes when no patterns are configured', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('feat(release): polish', 'Body text')),
        Effect.provideService(RuleOptionsService, {}),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates when title does not match the configured regex', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('feat(release): polish', 'Body text')),
        Effect.provideService(RuleOptionsService, { titlePattern: '^fix\\(' }),
      ),
    )

    expect(result).toBeDefined()
    if (!result || !('location' in result)) {
      throw new Error('expected a title violation')
    }

    expect(PrTitle.is(result.location)).toBe(true)
  })

  test('violates when body does not match the configured regex', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(makePrLayer('feat(release): polish', 'Body text')),
        Effect.provideService(RuleOptionsService, { bodyPattern: '^Checklist:' }),
      ),
    )

    expect(result).toBeDefined()
    if (!result || !('location' in result)) {
      throw new Error('expected a body violation')
    }

    expect(PrBody.is(result.location)).toBe(true)
  })

  test('fails fast on invalid regex configuration', async () => {
    await expect(
      Effect.runPromise(
        rule.check.pipe(
          Effect.provide(makePrLayer('feat(release): polish', 'Body text')),
          Effect.provideService(RuleOptionsService, { titlePattern: '[' }),
        ),
      ),
    ).rejects.toThrow('Invalid title regex for pr.message.format')
  })
})
