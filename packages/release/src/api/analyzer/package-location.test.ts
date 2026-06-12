import { Fs } from '@kitz/fs'
import { Result } from 'effect'
import { describe, expect, test } from 'bun:test'
import { PackageLocation } from './package-location.js'

const fromAbsolutePath = (root: string, path: string) =>
  Result.getOrThrow(
    PackageLocation.fromAbsolutePath(
      Fs.Path.AbsDir.fromString(root),
      Fs.Path.AbsDir.fromString(path),
    ),
  )

describe('PackageLocation', () => {
  test('derives repo-relative package paths from discovered workspace locations', () => {
    const location = fromAbsolutePath('/repo/', '/repo/tooling/pkg-core/')

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

  test('package paths outside the repo root are a typed failure, not a crash', () => {
    const result = PackageLocation.fromAbsolutePath(
      Fs.Path.AbsDir.fromString('/repo/'),
      Fs.Path.AbsDir.fromString('/elsewhere/pkg-core/'),
    )

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('PackageLocationError')
      expect(result.failure.context.problem).toBe('outside-root')
      expect(result.failure.message).toContain('is not inside repo root')
    }
  })

  test('matches repo-relative changed files through the shared location helper', () => {
    const location = fromAbsolutePath('/repo/', '/repo/tooling/pkg-core/')

    expect(PackageLocation.containsRepoPath(location, 'tooling/pkg-core/src/index.ts')).toBe(true)
    expect(PackageLocation.containsRepoPath(location, 'packages/core/src/index.ts')).toBe(false)
  })
})
