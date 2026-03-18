import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { FileSystemLayer } from '../../platform.js'
import { loadNotesPackagesWith, resolveNotesPackages } from './notes-lib.js'

describe('notes package loading', () => {
  test('honors config.packages when resolving workspace packages', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-notes-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-cli'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            workspaces: ['tooling/*'],
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-core', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-cli', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/cli',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          resolveNotesPackages({
            core: '@kitz/core',
          }),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(packages).toHaveLength(1)
      expect(packages[0]!.scope).toBe('core')
      expect(packages[0]!.name.moniker).toBe('@kitz/core')
      expect(Fs.Path.toString(packages[0]!.path)).toBe(`${rootDir}/tooling/pkg-core/`)
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('loads config.packages before resolving notes packages', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-notes-load-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-cli'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            type: 'module',
            workspaces: ['tooling/*'],
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-core', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-cli', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/cli',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          loadNotesPackagesWith(
            Effect.succeed({
              packages: {
                core: '@kitz/core',
              },
            }),
          ),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(packages).toHaveLength(1)
      expect(packages[0]!.scope).toBe('core')
      expect(packages[0]!.name.moniker).toBe('@kitz/core')
      expect(Fs.Path.toString(packages[0]!.path)).toBe(`${rootDir}/tooling/pkg-core/`)
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('keeps auto-scan behavior when config.packages is empty', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-notes-default-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-cli'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            type: 'module',
            workspaces: ['tooling/*'],
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-core', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/core',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(rootDir, 'tooling', 'pkg-cli', 'package.json'),
        JSON.stringify(
          {
            name: '@kitz/cli',
            version: '1.0.0',
          },
          null,
          2,
        ),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          loadNotesPackagesWith(
            Effect.succeed({
              packages: {},
            }),
          ),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(packages).toHaveLength(2)
      expect(packages.map((pkg) => pkg.name.moniker).sort()).toEqual(['@kitz/cli', '@kitz/core'])
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
