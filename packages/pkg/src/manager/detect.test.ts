import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { detect } from './detect.js'
import { renderScriptCommand } from './render.js'

describe('Pkg.Manager.detect', () => {
  test('prefers the package-manager user agent from the environment', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')

    const detected = await Effect.runPromise(
      detect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({}),
            Env.Test({
              cwd,
              vars: {
                npm_config_user_agent: 'bun/1.3.6 darwin arm64',
              },
            }),
          ),
        ),
      ),
    )

    expect(detected.name).toBe('bun')
    expect(detected.source).toBe('user-agent')
  })

  test('falls back to the nearest package.json packageManager field', async () => {
    const detected = await Effect.runPromise(
      detect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({
              '/repo/package.json': JSON.stringify(
                { name: 'workspace', packageManager: 'pnpm@10.7.0' },
                null,
                2,
              ),
            }),
            Env.Test({
              cwd: Fs.Path.AbsDir.fromString('/repo/packages/release/'),
            }),
          ),
        ),
      ),
    )

    expect(detected.name).toBe('pnpm')
    expect(detected.source).toBe('manifest')
  })

  test('falls back to lockfiles when packageManager is absent', async () => {
    const detected = await Effect.runPromise(
      detect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Fs.Memory.layer({
              '/repo/package.json': JSON.stringify({ name: 'workspace' }, null, 2),
              '/repo/bun.lock': '',
            }),
            Env.Test({
              cwd: Fs.Path.AbsDir.fromString('/repo/packages/release/'),
            }),
          ),
        ),
      ),
    )

    expect(detected.name).toBe('bun')
    expect(detected.source).toBe('lockfile')
  })
})

describe('Pkg.Manager.renderScriptCommand', () => {
  test('renders Bun and pnpm script invocations', () => {
    expect(renderScriptCommand('bun', 'release', 'doctor')).toBe('bun run release doctor')
    expect(renderScriptCommand('pnpm', 'release', 'doctor')).toBe('pnpm release doctor')
  })

  test('renders npm script invocations with argument separator', () => {
    expect(renderScriptCommand('npm', 'release', 'doctor --all')).toBe(
      'npm run release -- doctor --all',
    )
  })
})
