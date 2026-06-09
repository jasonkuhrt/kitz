import { Semver } from '@kitz/semver'
import { describe, expect, test } from 'bun:test'
import {
  findLocalDependencyNames,
  findPackHooks,
  findPublishOrderDependencyNames,
  rewriteManifestForPack,
} from './publish.js'

describe('Pkg.Manifest publish rewrite', () => {
  test('rewrites version, runtime targets, and workspace protocol dependencies for pack', () => {
    const result = rewriteManifestForPack(
      {
        name: '@kitz/release',
        version: '0.0.0-kitz-release',
        imports: {
          '#release': './src/_.ts',
          '#platform:release/*': {
            browser: './src/*.browser.ts',
            default: './src/*.node.ts',
          },
        },
        exports: {
          '.': './src/__.ts',
        },
        dependencies: {
          '@kitz/core': 'workspace:*',
          '@kitz/fs': 'workspace:^',
          ansis: 'catalog:',
          effect: '^3.19.13',
        },
        peerDependencies: {
          '@kitz/env': 'workspace:~',
          '@kitz/git': 'workspace:^1.0.0',
        },
        devDependencies: {
          '@kitz/platform': 'workspace:*',
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
        catalogVersions: {
          ansis: '^4.3.1',
        },
      },
    )

    expect(result['version']).toBe('1.4.0')
    expect(result['imports']).toEqual({
      '#release': './build/_.js',
      '#platform:release/*': {
        browser: './build/*.browser.js',
        default: './build/*.node.js',
      },
    })
    expect(result['exports']).toEqual({
      '.': './build/__.js',
    })
    expect(result['dependencies']).toEqual({
      '@kitz/core': '1.0.0',
      '@kitz/fs': '^2.0.0',
      ansis: '^4.3.1',
      effect: '^3.19.13',
    })
    expect(result['peerDependencies']).toEqual({
      '@kitz/env': '~3.0.0',
      '@kitz/git': '^1.0.0',
    })
    expect(result).not.toHaveProperty('devDependencies')
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
        ['@kitz/core', '@kitz/fs', '@kitz/git'],
      ),
    ).toEqual(['@kitz/core', '@kitz/fs'])
  })

  test('findPublishOrderDependencyNames ignores local dev and peer dependency cycles', () => {
    const manifestWithNonRuntimeDeps = {
      dependencies: {},
      optionalDependencies: {},
      devDependencies: {
        '@kitz/assert': 'workspace:*',
      },
      peerDependencies: {
        '@kitz/fs': 'workspace:*',
      },
    }

    expect(
      findPublishOrderDependencyNames(
        {
          dependencies: {
            '@kitz/core': 'workspace:*',
          },
          optionalDependencies: {
            '@kitz/git': 'workspace:*',
          },
        },
        ['@kitz/assert', '@kitz/core', '@kitz/fs', '@kitz/git'],
      ),
    ).toEqual(['@kitz/core', '@kitz/git'])

    expect(
      findPublishOrderDependencyNames(manifestWithNonRuntimeDeps, [
        '@kitz/assert',
        '@kitz/core',
        '@kitz/fs',
        '@kitz/git',
      ]),
    ).toEqual([])
  })
})
