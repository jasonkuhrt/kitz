import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import { DateTime, Deferred, Effect, Exit, Fiber, FileSystem, Layer, Option } from 'effect'
import * as fc from 'fast-check'
import { roundtrips } from '../test-support.js'
import { ExecutionLock } from './contract/lock.js'
import { sha256Json } from './digest.js'
import {
  acquireLocal,
  isExpired,
  lockPathFor,
  make,
  read,
  releaseLocal,
  validate,
  withLocal,
} from './lock.js'

const digest = sha256Json({ plan: 'lock' })
const utc = (iso: string): DateTime.Utc => DateTime.makeUnsafe(iso)

describe('release execution lock', () => {
  test('validates active and expired locks', () => {
    const active = make({
      planDigest: digest,
      ownerId: 'jason',
      ownerHost: 'dev-machine',
      ownerProcess: 'release-shell',
      acquiredAt: utc('2026-05-14T00:00:00.000Z'),
      heartbeatAt: utc('2026-05-14T00:00:15.000Z'),
      ttlSeconds: 60,
    })

    expect(active.ownerHost).toBe('dev-machine')
    expect(active.ownerProcess).toBe('release-shell')
    expect(DateTime.formatIso(active.heartbeatAt)).toBe('2026-05-14T00:00:15.000Z')
    expect(DateTime.formatIso(active.expiresAt)).toBe('2026-05-14T00:01:00.000Z')
    expect(active.backend).toBe('local-file')
    expect(validate(active, utc('2026-05-14T00:00:30.000Z'))).toEqual([])
    expect(validate(active, utc('2026-05-14T00:01:00.000Z')).map((issue) => issue.code)).toEqual([
      'release.lock.expired',
    ])
  })

  Test.property(
    'expiry comparison is total and antisymmetric over valid DateTimes',
    fc.date({ noInvalidDate: true }),
    fc.date({ noInvalidDate: true }),
    (left, right) => {
      const a = DateTime.fromDateUnsafe(left)
      const b = DateTime.fromDateUnsafe(right)
      const lockAtA = make({ planDigest: digest, ownerId: 'p', acquiredAt: a, ttlSeconds: 0 })
      const lockAtB = make({ planDigest: digest, ownerId: 'p', acquiredAt: b, ttlSeconds: 0 })

      const aExpiredAtB = isExpired(lockAtA, b) // a <= b
      const bExpiredAtA = isExpired(lockAtB, a) // b <= a

      // Totality: for any two instants at least one direction holds.
      expect(aExpiredAtB || bExpiredAtA).toBe(true)
      // Antisymmetry: both directions hold exactly when the instants are equal.
      expect(aExpiredAtB && bExpiredAtA).toBe(left.getTime() === right.getTime())
    },
  )

  test('acquires and releases a local plan-bound lock', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const lock = yield* acquireLocal({
          planDigest: digest,
          ownerId: 'jason',
          ownerHost: 'dev-machine',
          ownerProcess: 'release-shell',
          now: utc('2026-05-14T00:00:00.000Z'),
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
    expect(DateTime.formatIso(result.lock.heartbeatAt)).toBe('2026-05-14T00:00:00.000Z')
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
              now: utc('2026-05-14T00:00:00.000Z'),
            },
            Effect.fail(new Error('publish failed')),
          ),
        )
        const after = yield* read(lockPathFor(cwd, digest))
        return { exit, after }
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(Exit.isFailure(result.exit)).toBe(true)
    const failure = Option.getOrUndefined(Exit.findErrorOption(result.exit))
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('publish failed')
    expect(Option.isNone(result.after)).toBe(true)
  })

  test('corrupt persisted lock timestamps fail decode instead of behaving as an eternal lock', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const path = lockPathFor(cwd, digest)
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        yield* Fs.write(
          path,
          JSON.stringify({
            schemaVersion: 1,
            planDigest: { algorithm: 'sha256', value: digest.value },
            owner: { kind: 'human', id: 'jason' },
            ownerHost: 'dev-machine',
            ownerProcess: 'release-shell',
            acquiredAt: '2026-05-14T00:00:00.000Z',
            heartbeatAt: '2026-05-14T00:00:00.000Z',
            expiresAt: 'garbage-not-a-timestamp',
            backend: 'local-file',
            recoveryRequiresSignature: true,
          }),
        )
        return yield* read(path).pipe(Effect.flip)
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(error).toBeInstanceOf(Resource.ParseError)
  })

  test('an expired lock is recovered by a later acquisition', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* acquireLocal({
          planDigest: digest,
          ownerId: 'jason',
          now: utc('2026-05-14T00:00:00.000Z'),
          ttlSeconds: 60,
        })
        return yield* acquireLocal({
          planDigest: digest,
          ownerId: 'second-operator',
          now: utc('2026-05-14T02:00:00.000Z'),
        })
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(result.owner.id).toBe('second-operator')
  })

  test('interruption during acquisition cannot leak the lock file', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const path = lockPathFor(cwd, digest)
    const lockPathString = Fs.Path.toString(path)

    const after = await Effect.runPromise(
      Effect.gen(function* () {
        const writeObserved = yield* Deferred.make<void>()
        const gate = yield* Deferred.make<void>()

        const gatedLayer = Layer.effect(
          FileSystem.FileSystem,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem
            const writeFileString: typeof fs.writeFileString = (filePath, content, options) =>
              Effect.gen(function* () {
                yield* fs.writeFileString(filePath, content, options)
                if (filePath === lockPathString) {
                  yield* Deferred.succeed(writeObserved, void 0)
                  yield* Deferred.await(gate)
                }
              })
            return { ...fs, writeFileString }
          }),
        ).pipe(Layer.provide(Fs.Memory.layer({})))

        return yield* Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(
            withLocal(
              {
                planDigest: digest,
                ownerId: 'jason',
                now: utc('2026-05-14T00:00:00.000Z'),
              },
              Effect.never,
            ),
          )
          // The lock file write has completed inside acquisition; interrupt
          // before acquisition finishes, then release the gate.
          yield* Deferred.await(writeObserved)
          const interruption = yield* Effect.forkChild(Fiber.interrupt(fiber), {
            startImmediately: true,
          })
          yield* Deferred.succeed(gate, void 0)
          yield* Fiber.join(interruption)
          return yield* read(path)
        }).pipe(Effect.provide(Layer.mergeAll(gatedLayer, Env.Test({ cwd }))))
      }),
    )

    expect(Option.isNone(after)).toBe(true)
  })

  test('refuses to acquire a second active lock for the same plan digest', async () => {
    const cwd = Fs.Path.AbsDir.fromString('/repo/')
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        yield* acquireLocal({
          planDigest: digest,
          ownerId: 'jason',
          now: utc('2026-05-14T00:00:00.000Z'),
        })
        return yield* Effect.exit(
          acquireLocal({
            planDigest: digest,
            ownerId: 'other',
            now: utc('2026-05-14T00:00:01.000Z'),
          }),
        )
      }).pipe(Effect.provide(Layer.mergeAll(Fs.Memory.layer({}), Env.Test({ cwd })))),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    const failure = Option.getOrUndefined(Exit.findErrorOption(exit))
    expect(failure).toMatchObject({
      _tag: 'ActiveReleaseLockError',
      tags: ['kit', 'release', 'lock'],
      context: {
        planDigest: digest.value,
      },
    })
  })
})

// ── Properties ───────────────────────────────────────────────────────

roundtrips('ExecutionLock', ExecutionLock)
