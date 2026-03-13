import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { PrTitle } from '../models/violation-location.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-type-match-known.js'

const makePrLayer = (title: string, commit: CC.Commit.Commit) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: Option.some(commit),
    titleParseError: Option.none(),
  })

describe('pr.type.match-known', () => {
  test('passes when every target type is standard in a multi-target title', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          makePrLayer(
            'feat(core), fix(cli): polish release flow',
            new CC.Commit.Multi({
              targets: [
                new CC.Target({ type: CC.Type.parse('feat'), scope: 'core', breaking: false }),
                new CC.Target({ type: CC.Type.parse('fix'), scope: 'cli', breaking: false }),
              ],
              message: 'polish release flow',
              summary: Option.none(),
              sections: {},
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates when any target type is custom in a multi-target title', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          makePrLayer(
            'feat(core), wip(cli): polish release flow',
            new CC.Commit.Multi({
              targets: [
                new CC.Target({ type: CC.Type.parse('feat'), scope: 'core', breaking: false }),
                new CC.Target({ type: CC.Type.parse('wip'), scope: 'cli', breaking: false }),
              ],
              message: 'polish release flow',
              summary: Option.none(),
              sections: {},
            }),
          ),
        ),
      ),
    )

    expect(result).toBeDefined()
    if (!result || !('location' in result)) {
      throw new Error('expected a violation')
    }

    expect(PrTitle.is(result.location)).toBe(true)
  })
})
