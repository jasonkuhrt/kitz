import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { PrTitle } from '../models/violation-location.js'
import { DiffService } from '../services/diff.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-type-release-kind-match-diff.js'

const diffWithSrcChanges = Layer.succeed(DiffService, {
  files: [{ path: 'packages/release/src/api/projected-squash-commit.ts', status: 'modified' as const }],
  affectedPackages: ['release'],
})

const makePrLayer = (title: string, commit: CC.Commit.Commit) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: Option.some(commit),
    titleParseError: Option.none(),
  })

describe('pr.type.release-kind-match-diff', () => {
  test('passes when a mixed-type title includes at least one release-triggering target', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(diffWithSrcChanges),
        Effect.provide(
          makePrLayer(
            'docs(core), feat(release): polish release flow',
            CC.Commit.Multi.make({
              targets: [
                CC.Target.make({ type: CC.Type.parse('docs'), scope: 'core', breaking: false }),
                CC.Target.make({ type: CC.Type.parse('feat'), scope: 'release', breaking: false }),
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

  test('passes when a nominally no-release type is marked breaking', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(diffWithSrcChanges),
        Effect.provide(
          makePrLayer(
            'docs(release)!: document release architecture',
            CC.Commit.Single.make({
              type: CC.Type.parse('docs'),
              scopes: ['release'],
              breaking: true,
              message: 'document release architecture',
              body: Option.none(),
              footers: [],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates when every target is no-release and src files changed', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(diffWithSrcChanges),
        Effect.provide(
          makePrLayer(
            'docs(core), chore(release): polish release docs',
            CC.Commit.Multi.make({
              targets: [
                CC.Target.make({ type: CC.Type.parse('docs'), scope: 'core', breaking: false }),
                CC.Target.make({ type: CC.Type.parse('chore'), scope: 'release', breaking: false }),
              ],
              message: 'polish release docs',
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
