import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'vitest'
import { findLocalDependencyNames, findPackHooks, rewriteManifestForPack } from './publish.js'

describe('Pkg.Manifest publish rewrite', () => {
  test('rewrites version, runtime targets, and workspace protocol dependencies for pack', () => {
    const result = rewriteManifestForPack(
      {
        name: '@kitz/release',
        version: '0.0.0-kitz-release',
        imports: {
          '#release': {
            types: './build/_.d.ts',
            default: './src/_.ts',
          },
        },
        exports: {
          '.': {
            types: './build/__.d.ts',
            default: './src/__.ts',
          },
        },
        dependencies: {
          '@kitz/core': 'workspace:*',
          '@kitz/fs': 'workspace:^',
          effect: '^3.19.13',
        },
        peerDependencies: {
          '@kitz/env': 'workspace:~',
          '@kitz/git': 'workspace:^1.0.0',
        },
      },
      {
        version: Semver.fromString('1.4.0'),
        workspaceVersions: {
          '@kitz/core': Semver.fromString('1.0.0'),
          '@kitz/fs': Semver.fromString('2.0.0'),
          '@kitz/env': Semver.fromString('3.0.0'),
          '@kitz/git': Semver.fromString('4.0.0'),
        },
      },
    )

    expect(result['version']).toBe('1.4.0')
    expect(result['imports']).toEqual({
      '#release': {
        types: './build/_.d.ts',
        default: './build/_.js',
      },
    })
    expect(result['exports']).toEqual({
      '.': {
        types: './build/__.d.ts',
        default: './build/__.js',
      },
    })
    expect(result['dependencies']).toEqual({
      '@kitz/core': '1.0.0',
      '@kitz/fs': '^2.0.0',
      effect: '^3.19.13',
    })
    expect(result['peerDependencies']).toEqual({
      '@kitz/env': '~3.0.0',
      '@kitz/git': '^1.0.0',
    })
  })

  test.each([
    [{ prepack: 'echo before' }, ['prepack']],
    [{ prepare: 'tsgo -p tsconfig.build.json' }, ['prepare']],
    [{ postpack: 'echo after' }, ['postpack']],
    [{ prepack: 'echo before', postpack: 'echo after' }, ['prepack', 'postpack']],
    [
      {
        prepack: 'echo before',
        prepare: 'tsgo -p tsconfig.build.json',
        postpack: 'echo after',
        publish: 'echo publish',
      },
      ['prepack', 'prepare', 'postpack'],
    ],
  ])('findPackHooks reports only pack-time hooks for %j', (scripts, expected) => {
    expect(findPackHooks(scripts)).toEqual(expected)
  })

  test('findLocalDependencyNames collects local dependencies across dependency sections', () => {
    expect(
      findLocalDependencyNames(
        {
          dependencies: {
            '@kitz/core': 'workspace:*',
            effect: '^3.19.13',
          },
          peerDependencies: {
            '@kitz/fs': 'workspace:^',
          },
          optionalDependencies: {
            '@kitz/core': 'workspace:*',
          },
        },
        new Set(['@kitz/core', '@kitz/fs', '@kitz/git']),
      ),
    ).toEqual(['@kitz/core', '@kitz/fs'])
  })
})
