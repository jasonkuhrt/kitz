import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Effect, MutableHashMap, Option, Ref } from 'effect'
import { describe, expect, test } from 'bun:test'
import { auditPackageHistory, getPackageTagInfos, groupReleaseTagsByPackage } from './monotonic.js'

describe('groupReleaseTagsByPackage', () => {
  test('parses each tag once and groups official releases by package', () => {
    const grouped = groupReleaseTagsByPackage([
      '@kitz/core@1.0.0',
      '@kitz/core@1.1.0',
      '@kitz/other@0.1.0',
      '@kitz/core@2.0.0-next.1', // prerelease — ignored
      'not-a-pin', // unparseable — ignored
    ])

    const get = (packageName: string) =>
      Option.getOrUndefined(MutableHashMap.get(grouped, packageName))

    expect([...MutableHashMap.keys(grouped)].sort()).toEqual(['@kitz/core', '@kitz/other'])
    expect(get('@kitz/core')!.map((parsed) => parsed.tag)).toEqual([
      '@kitz/core@1.0.0',
      '@kitz/core@1.1.0',
    ])
    expect(get('@kitz/other')!.map((parsed) => Semver.toString(parsed.version))).toEqual(['0.1.0'])
  })
})

describe('getPackageTagInfos', () => {
  test('resolves SHAs for the package tags, sorted by version descending', async () => {
    const tags = ['@kitz/core@1.0.0', '@kitz/core@1.1.0', '@kitz/other@0.1.0']
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const { layer, state } = yield* Git.Memory.makeWithState({ tags })
        yield* Ref.set(state.tagShas, {
          '@kitz/core@1.0.0': Git.Sha.make('aaa1234'),
          '@kitz/core@1.1.0': Git.Sha.make('bbb1234'),
          '@kitz/other@0.1.0': Git.Sha.make('ccc1234'),
        })
        return yield* getPackageTagInfos('@kitz/core', tags).pipe(Effect.provide(layer))
      }),
    )

    expect(result.map((info) => [Semver.toString(info.version), info.sha])).toEqual([
      ['1.1.0', 'bbb1234'],
      ['1.0.0', 'aaa1234'],
    ])
  })
})

describe('auditPackageHistory', () => {
  const setup = (parents: Record<string, string[]>) =>
    Effect.gen(function* () {
      const tags = ['@kitz/core@1.0.0', '@kitz/core@1.1.0']
      const { layer, state } = yield* Git.Memory.makeWithState({ tags })
      yield* Ref.set(state.tagShas, {
        '@kitz/core@1.0.0': Git.Sha.make('aaa1234'),
        '@kitz/core@1.1.0': Git.Sha.make('bbb1234'),
      })
      yield* Ref.set(state.commitParents, parents)
      const tagInfos = yield* getPackageTagInfos('@kitz/core', tags).pipe(Effect.provide(layer))
      return yield* auditPackageHistory('@kitz/core', tagInfos).pipe(Effect.provide(layer))
    })

  test('valid when versions increase with commit order', async () => {
    // 1.0.0 (aaa1234) is the ancestor of 1.1.0 (bbb1234)
    const result = await Effect.runPromise(setup({ bbb1234: ['aaa1234'] }))
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  test('violation when an earlier commit carries the higher version', async () => {
    // 1.1.0 (bbb1234) is the ancestor of 1.0.0 (aaa1234)
    const result = await Effect.runPromise(setup({ aaa1234: ['bbb1234'] }))
    expect(result.valid).toBe(false)
    expect(result.violations).toHaveLength(1)
    const violation = result.violations[0]!
    expect(Semver.toString(violation.earlier.version)).toBe('1.1.0')
    expect(Semver.toString(violation.later.version)).toBe('1.0.0')
    expect(violation.message).toContain('comes BEFORE')
  })
})
