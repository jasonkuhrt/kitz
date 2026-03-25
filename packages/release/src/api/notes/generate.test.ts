import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { generate } from './generate.js'

const makePackage = (scope: string, name = `@kitz/${scope}`) => ({
  scope,
  name: Pkg.Moniker.parse(name),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

describe('notes.generate', () => {
  test('generates release notes and tracks unchanged packages across release boundaries', async () => {
    const packages = [makePackage('core'), makePackage('cli'), makePackage('docs')]
    const result = await Effect.runPromise(
      generate({
        packages,
        tags: ['@kitz/core@1.0.0'],
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: ['@kitz/core@1.0.0'],
            commits: [
              Git.Memory.commit('fix(cli): patch cli'),
              Git.Memory.commit('feat(core): add new api'),
              Git.Memory.commit('feat(core): release 1.0.0'),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(2)

    const core = result.notes.find((note) => note.package.name.moniker === '@kitz/core')
    const cli = result.notes.find((note) => note.package.name.moniker === '@kitz/cli')

    expect(core?.bump).toBe('minor')
    expect(Option.isSome(core?.currentVersion ?? Option.none())).toBe(true)
    expect(core?.nextVersion.toString()).toBe('1.1.0')
    expect(core?.notes.markdown).toContain('## @kitz/core v1.1.0')
    expect(core?.notes.markdown).toContain('### Features')

    expect(cli?.bump).toBe('patch')
    expect(Option.isNone(cli?.currentVersion ?? Option.none())).toBe(true)
    expect(cli?.nextVersion.toString()).toBe('0.0.1')
    expect(cli?.notes.markdown).toContain('### Bug Fixes')

    expect(result.unchanged.map((pkg) => pkg.name.moniker)).toEqual(['@kitz/docs'])
  })

  test('respects package filters and skips unselected packages entirely', async () => {
    const packages = [makePackage('core'), makePackage('cli')]
    const result = await Effect.runPromise(
      generate({
        packages,
        tags: [],
        filter: ['core'],
      }).pipe(
        Effect.provide(
          Git.Memory.make({
            tags: [],
            commits: [
              Git.Memory.commit('feat(core): add feature'),
              Git.Memory.commit('fix(cli): patch cli'),
            ],
          }),
        ),
      ),
    )

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]!.package.name.moniker).toBe('@kitz/core')
    expect(result.unchanged).toEqual([])
  })
})
