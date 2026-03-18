import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import { isReadyCommandWorkspace, loadCommandWorkspaceWith } from './command-workspace.js'

const makeResolvedConfig = (
  packages: Api.Analyzer.Workspace.PackageMap,
): Api.Config.ResolvedConfig =>
  Api.Config.ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages,
    publishing: Api.Publishing.defaultPublishing(),
    operator: Api.Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      }),
      releaseCommand: 'bun run release',
      prepareCommands: [],
    }),
    lint: Api.Lint.resolveConfig({}),
  })

describe('command workspace bootstrap', () => {
  test('honors config.packages when resolving workspace packages', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-command-workspace-'))

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

      const workspace = await Effect.runPromise(
        Effect.provide(
          loadCommandWorkspaceWith(
            Effect.succeed(
              makeResolvedConfig({
                core: '@kitz/core',
              }),
            ),
          ),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(isReadyCommandWorkspace(workspace)).toBe(true)
      if (!isReadyCommandWorkspace(workspace)) {
        throw new Error('expected workspace packages')
      }

      expect(workspace.packages).toHaveLength(1)
      expect(workspace.packages[0]!.scope).toBe('core')
      expect(workspace.packages[0]!.name.moniker).toBe('@kitz/core')
      expect(Fs.Path.toString(workspace.packages[0]!.path)).toBe(`${rootDir}/tooling/pkg-core/`)
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('keeps auto-scan behavior when config.packages is empty', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-command-workspace-default-'))

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

      const workspace = await Effect.runPromise(
        Effect.provide(
          loadCommandWorkspaceWith(Effect.succeed(makeResolvedConfig({}))),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(isReadyCommandWorkspace(workspace)).toBe(true)
      if (!isReadyCommandWorkspace(workspace)) {
        throw new Error('expected workspace packages')
      }

      expect(workspace.packages).toHaveLength(2)
      expect(workspace.packages.map((pkg) => pkg.name.moniker).sort()).toEqual([
        '@kitz/cli',
        '@kitz/core',
      ])
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  test('returns an empty workspace result when no packages resolve', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'kitz-release-command-workspace-empty-'))

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

      const workspace = await Effect.runPromise(
        Effect.provide(
          loadCommandWorkspaceWith(Effect.succeed(makeResolvedConfig({}))),
          Layer.mergeAll(
            FileSystemLayer,
            Env.Test({ cwd: Fs.Path.AbsDir.fromString(`${rootDir}/`) }),
          ),
        ),
      )

      expect(workspace._tag).toBe('EmptyCommandWorkspace')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
