import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'vitest'
import { PackageLocation } from './package-location.js'

describe('PackageLocation', () => {
  test('derives repo-relative package paths from discovered workspace locations', () => {
    const location = PackageLocation.fromAbsolutePath(
      Fs.Path.AbsDir.fromString('/repo/'),
      Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
    )

    expect(Fs.Path.toString(location.path)).toBe('/repo/tooling/pkg-core/')
    expect(PackageLocation.toRelativePathString(location)).toBe('tooling/pkg-core')
    expect(
      PackageLocation.toSourceUrl(location, {
        owner: 'org',
        repo: 'repo',
        branch: 'main',
      }),
    ).toBe('https://github.com/org/repo/tree/main/tooling/pkg-core')
  })

  test('infers the standard configured package fallback layout in one place', () => {
    const location = PackageLocation.inferDefault(Fs.Path.AbsDir.fromString('/repo/'), 'core')

    expect(Fs.Path.toString(location.path)).toBe('/repo/packages/core/')
    expect(PackageLocation.toRelativePathString(location)).toBe('packages/core')
  })

  test('rejects package paths that are outside the repo root', () => {
    expect(() =>
      PackageLocation.fromAbsolutePath(
        Fs.Path.AbsDir.fromString('/repo/'),
        Fs.Path.AbsDir.fromString('/elsewhere/pkg-core/'),
      ),
    ).toThrow('is not inside repo root')
  })

  test('matches repo-relative changed files through the shared location helper', () => {
    const location = PackageLocation.fromAbsolutePath(
      Fs.Path.AbsDir.fromString('/repo/'),
      Fs.Path.AbsDir.fromString('/repo/tooling/pkg-core/'),
    )

    expect(PackageLocation.containsRepoPath(location, 'tooling/pkg-core/src/index.ts')).toBe(true)
    expect(PackageLocation.containsRepoPath(location, 'packages/core/src/index.ts')).toBe(false)
  })
})
