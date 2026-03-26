import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { FileSystemLayer } from '../../platform.js'
import * as Workspace from './workspace.js'

const makePackageJson = (name: string, version: string) =>
  JSON.stringify(
    {
      name,
      version,
    },
    null,
    2,
  )

describe('Workspace.resolvePackages', () => {
  test('honors explicit configured package paths', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-explicit-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
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
        makePackageJson('@kitz/core', '1.0.0'),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
            core: {
              name: '@kitz/core',
              path: './tooling/pkg-core/',
            },
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

  test('uses workspace-discovered package paths for configured scope mappings', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
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
        makePackageJson('@kitz/core', '1.0.0'),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
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

  test('fails when a configured scope points at a package name not found by workspace discovery', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
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
        makePackageJson('@kitz/core', '1.0.0'),
      )

      const result = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
            core: '@kitz/core-legacy',
          }),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ).pipe(Effect.result),
      )

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.failure._tag).toBe('PackageResolutionError')
        if (result.failure._tag === 'PackageResolutionError') {
          expect(result.failure.context.scope).toBe('core')
          expect(result.failure.context.packageName).toBe('@kitz/core-legacy')
        }
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('resolves explicit package paths even when workspace discovery is unavailable', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-fallback-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            type: 'module',
            workspaces: [],
          },
          null,
          2,
        ),
      )

      const packages = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
            core: {
              name: '@kitz/core',
              path: 'tooling/pkg-core',
            },
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

  test('fails when configured packages depend on discovery but workspace scanning is unavailable', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-missing-scan-'))

    try {
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            type: 'module',
            workspaces: [],
          },
          null,
          2,
        ),
      )

      const result = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
            core: '@kitz/core',
          }),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ).pipe(Effect.result),
      )

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.failure._tag).toBe('PackageResolutionError')
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('fails mixed configured package maps when any entry still depends on unavailable discovery', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-workspace-mixed-scan-'))

    try {
      mkdirSync(path.join(rootDir, 'tooling', 'pkg-core'), { recursive: true })
      writeFileSync(
        path.join(rootDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixture/repo',
            private: true,
            type: 'module',
            workspaces: [],
          },
          null,
          2,
        ),
      )

      const result = await Effect.runPromise(
        Effect.provide(
          Workspace.resolvePackages({
            core: {
              name: '@kitz/core',
              path: 'tooling/pkg-core',
            },
            cli: '@kitz/cli',
          }),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ).pipe(Effect.result),
      )

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.failure._tag).toBe('PackageResolutionError')
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
