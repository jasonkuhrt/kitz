import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { DateTime, Effect, FileSystem, Option, Schema as S } from 'effect'
import { ExecutionLock } from './contract/lock.js'
import { PrincipalRef } from './contract/trust.js'
import { Digest } from './digest.js'

const baseTags = ['kit', 'release', 'lock'] as const
const lockDir = Fs.Path.RelDir.fromString('./.release/locks/')

/**
 * `readOrEmpty` placeholder only: an epoch-expired lock, so accidental use of
 * the empty value behaves like "no active lock" instead of an eternal one.
 */
const emptyLock = (): ExecutionLock =>
  ExecutionLock.make({
    schemaVersion: 1,
    planDigest: Digest.make({ algorithm: 'sha256', value: '' }),
    owner: PrincipalRef.make({ kind: 'human', id: 'nobody' }),
    ownerHost: 'none',
    ownerProcess: 'none',
    acquiredAt: DateTime.makeUnsafe(0),
    heartbeatAt: DateTime.makeUnsafe(0),
    expiresAt: DateTime.makeUnsafe(0),
    backend: 'local-file',
    recoveryRequiresSignature: true,
  })

const lockResource = Resource.createJson('lock.json', ExecutionLock, emptyLock())

const ActiveReleaseLockErrorContext = S.Struct({
  planDigest: S.String,
  ownerId: S.String,
  expiresAt: S.String,
})

export const ActiveReleaseLockError: Err.TaggedContextualErrorClass<
  'ActiveReleaseLockError',
  typeof baseTags,
  typeof ActiveReleaseLockErrorContext,
  undefined
> = Err.TaggedContextualError('ActiveReleaseLockError', baseTags, {
  context: ActiveReleaseLockErrorContext,
  message: (ctx) => `Active release lock already exists for ${ctx.planDigest}`,
})

export type ActiveReleaseLockError = InstanceType<typeof ActiveReleaseLockError>

export type LockError = ActiveReleaseLockError

export interface LockIssue {
  readonly code: string
  readonly detail: string
}

export interface LocalLockParams {
  readonly planDigest: Digest
  readonly ownerId: string
  readonly ownerHost?: string
  readonly ownerProcess?: string
  readonly now: DateTime.Utc
  readonly ttlSeconds?: number
}

export const lockPathFor = (cwd: Fs.Path.AbsDir, digest: Digest): Fs.Path.AbsFile =>
  Fs.Path.join(Fs.Path.join(cwd, lockDir), Fs.Path.RelFile.fromString(`./${digest.value}.json`))

export const make = (params: {
  readonly planDigest: Digest
  readonly ownerId: string
  readonly ownerHost?: string
  readonly ownerProcess?: string
  readonly acquiredAt: DateTime.Utc
  readonly heartbeatAt?: DateTime.Utc
  readonly ttlSeconds: number
  readonly backend?: ExecutionLock['backend']
  readonly remoteRef?: string
  readonly recoveryRequiresSignature?: boolean
}): ExecutionLock =>
  ExecutionLock.make({
    schemaVersion: 1,
    planDigest: params.planDigest,
    owner: PrincipalRef.make({ kind: 'human', id: params.ownerId }),
    ownerHost: params.ownerHost ?? 'local-host',
    ownerProcess: params.ownerProcess ?? 'local-process',
    acquiredAt: params.acquiredAt,
    heartbeatAt: params.heartbeatAt ?? params.acquiredAt,
    expiresAt: DateTime.add(params.acquiredAt, { seconds: params.ttlSeconds }),
    backend: params.backend ?? 'local-file',
    ...(params.remoteRef !== undefined ? { remoteRef: params.remoteRef } : {}),
    recoveryRequiresSignature: params.recoveryRequiresSignature ?? true,
  })

/**
 * Lock expiry. Total over `DateTime.Utc` values — malformed timestamps are
 * unrepresentable post-decode, so there is no NaN fail-open path.
 */
export const isExpired = (lock: ExecutionLock, now: DateTime.Utc): boolean =>
  DateTime.isLessThanOrEqualTo(lock.expiresAt, now)

export const validate = (lock: ExecutionLock, now: DateTime.Utc): readonly LockIssue[] =>
  isExpired(lock, now)
    ? [
        {
          code: 'release.lock.expired',
          detail: `Execution lock expired at ${DateTime.formatIso(lock.expiresAt)}.`,
        },
      ]
    : []

export const read = (
  path: Fs.Path.AbsFile,
): Effect.Effect<Option.Option<ExecutionLock>, Resource.ResourceError, FileSystem.FileSystem> =>
  lockResource.read(path)

export const write = (
  path: Fs.Path.AbsFile,
  lock: ExecutionLock,
): Effect.Effect<void, Resource.ResourceError, FileSystem.FileSystem> =>
  lockResource.write(lock, path)

export const acquireLocal = (
  params: LocalLockParams,
): Effect.Effect<
  ExecutionLock,
  LockError | Resource.ResourceError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const path = lockPathFor(env.cwd, params.planDigest)
    const existing = yield* read(path)
    if (Option.isSome(existing) && !isExpired(existing.value, params.now)) {
      return yield* Effect.fail(
        new ActiveReleaseLockError({
          context: {
            planDigest: params.planDigest.value,
            ownerId: existing.value.owner.id,
            expiresAt: DateTime.formatIso(existing.value.expiresAt),
          },
        }),
      )
    }
    const lock = make({
      planDigest: params.planDigest,
      ownerId: params.ownerId,
      ...(params.ownerHost !== undefined ? { ownerHost: params.ownerHost } : {}),
      ...(params.ownerProcess !== undefined ? { ownerProcess: params.ownerProcess } : {}),
      acquiredAt: params.now,
      heartbeatAt: params.now,
      ttlSeconds: params.ttlSeconds ?? 3_600,
      backend: 'local-file',
    })
    yield* write(path, lock)
    return lock
  })

export const releaseLocal = (
  planDigest: Digest,
): Effect.Effect<void, Resource.ResourceError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const path = lockPathFor(env.cwd, planDigest)
    yield* lockResource.delete(path)
  })

// oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
export const withLocal = <A, E, R>(
  params: LocalLockParams,
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<
  A,
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
  E | LockError | Resource.ResourceError,
  R | Env.Env | FileSystem.FileSystem
> =>
  // Uninterruptible acquire + guaranteed release: an interruption arriving
  // after the lock file is written can no longer leak the lock.
  Effect.acquireUseRelease(
    acquireLocal(params),
    () => effect,
    () => releaseLocal(params.planDigest).pipe(Effect.orDie),
  )
