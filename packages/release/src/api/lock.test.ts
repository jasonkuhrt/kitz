import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { describe, expect, test } from 'bun:test'
import { Effect, Exit, Layer, Option } from 'effect'
import { sha256Json } from './digest.js'
import { acquireLocal, lockPathFor, make, read, releaseLocal, validate, withLocal } from './lock.js'
import { PlanDigest } from './release-contract.js'

const digest = PlanDigest.make(sha256Json({ plan: 'lock' }))

describe('release execution lock', () => {
  test('validates active and expired locks', () => {
    const active = make({
      planDigest: digest,
      ownerId: 'jason',
      ownerHost: 'dev-machine',
      ownerProcess: 'release-shell',
      acquiredAt: '2026-05-14T00:00:00.000Z',
      heartbeatAt: '2026-05-14T00:00:15.000Z',
      ttlSeconds: 60,
    })

    expect(active.ownerHost).toBe('dev-machine')
    expect(active.ownerProcess).toBe('release-shell')
    expect(active.heartbeatAt).toBe('2026-05-14T00:00:15.000Z')
    expect(active.backend).toBe('local-file')
    expect(validate(active, '2026-05-14T00:00:30.000Z')).toEqual([])
    expect(validate(active, '2026-05-14T00:01:00.000Z').map((issue) => issue.code)).toEqual([
      'release.lock.expired',
    ])
  })

  test('acquires and releases a local plan-bound lock', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lock = yield* acquireLocal({
          planDigest: digest,
          ownerId: 'jason',
          ownerHost: 'dev-machine',
          ownerProcess: 'release-shell',
          now: '2026-05-14T00:00:00.000Z',
        })
        const before = yield* read(lockPathFor(cwd, digest))
        yield* releaseLocal(digest)
        const after = yield* read(lockPathFor(cwd, digest))
        return { lock, before, after }
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(result.lock.owner.id).toBe('jason')
    expect(result.lock.ownerHost).toBe('dev-machine')
    expect(result.lock.ownerProcess).toBe('release-shell')
    expect(result.lock.heartbeatAt).toBe('2026-05-14T00:00:00.000Z')
    expect(result.lock.backend).toBe('local-file')
    expect(Option.isSome(result.before)).toBe(true)
    expect(Option.isNone(result.after)).toBe(true)
  })

  test('releases the local lock when the protected operation fails', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          withLocal(
            {
              planDigest: digest,
              ownerId: 'jason',
              ownerHost: 'dev-machine',
              ownerProcess: 'release-shell',
              now: '2026-05-14T00:00:00.000Z',
            },
            Effect.fail(new Error('publish failed')),
          ),
        )
        const after = yield* read(lockPathFor(cwd, digest))
        return { exit, after }
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(Exit.isFailure(result.exit)).toBe(true)
    expect(Option.isNone(result.after)).toBe(true)
  })

  test('refuses to acquire a second active lock for the same plan digest', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        yield* acquireLocal({
          planDigest: digest,
          ownerId: 'jason',
          now: '2026-05-14T00:00:00.000Z',
        })
        return yield* Effect.exit(
          acquireLocal({
            planDigest: digest,
            ownerId: 'other',
            now: '2026-05-14T00:00:01.000Z',
          }),
        )
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})
