import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Ref } from 'effect'
import { describe, expect, test } from 'vitest'
import * as History from './history.js'

const packageName = '@kitz/core'
const version = Semver.fromString('1.0.0')
const tag = Pkg.Pin.toString(
  Pkg.Pin.Exact.make({
    name: Pkg.Moniker.parse(packageName),
    version,
  }),
)

describe('History.set', () => {
  test('moves existing tag and revalidates against refreshed tag list', async () => {
    const oldSha = Git.Sha.make('abc1234')
    const newSha = Git.Sha.make('def5678')

    const { layer, state } = await Effect.runPromise(
      Git.Memory.makeWithState({
        tags: [tag],
        commits: [Git.Memory.commit('feat(core): release move', { hash: newSha })],
      }),
    )

    await Effect.runPromise(
      Ref.set(state.tagShas, { [tag]: oldSha }),
    )

    const result = await Effect.runPromise(
      History.set({
        sha: newSha,
        pkg: packageName,
        ver: version,
        move: true,
        push: false,
      }).pipe(
        Effect.provide(layer),
      ),
    )

    expect(result.action).toBe('moved')
    expect(result.tag).toBe(tag)
    expect(result.sha).toBe(newSha)

    const tagShas = await Effect.runPromise(Ref.get(state.tagShas))
    expect(tagShas[tag]).toBe(newSha)
  })
})
