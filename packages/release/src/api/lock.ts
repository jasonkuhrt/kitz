import { Effect, FileSystem, Option, Schema } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { ExecutionLock, type PlanDigest, PrincipalRef } from './release-contract.js'

const lockDir = Fs.Path.RelDir.fromString('./.release/locks/')

export interface LockIssue {
  readonly code: string
  readonly detail: string
}

export interface LocalLockParams {
  readonly planDigest: PlanDigest
  readonly ownerId: string
  readonly ownerHost?: string
  readonly ownerProcess?: string
  readonly now: string
  readonly ttlSeconds?: number
}

export const lockPathFor = (cwd: Fs.Path.AbsDir, digest: PlanDigest): Fs.Path.AbsFile =>
  Fs.Path.join(Fs.Path.join(cwd, lockDir), Fs.Path.RelFile.fromString(`./${digest.value}.json`))

export const make = (params: {
  readonly planDigest: PlanDigest
  readonly ownerId: string
  readonly ownerHost?: string
  readonly ownerProcess?: string
  readonly acquiredAt: string
  readonly heartbeatAt?: string
  readonly ttlSeconds: number
  readonly backend?: ExecutionLock['backend']
  readonly remoteRef?: string
  readonly recoveryRequiresSignature?: boolean
}): ExecutionLock => {
  const expiresAt = new Date(Date.parse(params.acquiredAt) + params.ttlSeconds * 1000).toISOString()
  return ExecutionLock.make({
    schemaVersion: 1,
    planDigest: params.planDigest,
    owner: PrincipalRef.make({ kind: 'human', id: params.ownerId }),
    ownerHost: params.ownerHost ?? 'local-host',
    ownerProcess: params.ownerProcess ?? 'local-process',
    acquiredAt: params.acquiredAt,
    heartbeatAt: params.heartbeatAt ?? params.acquiredAt,
    expiresAt,
    backend: params.backend ?? 'local-file',
    ...(params.remoteRef !== undefined ? { remoteRef: params.remoteRef } : {}),
    recoveryRequiresSignature: params.recoveryRequiresSignature ?? true,
  })
}

export const validate = (lock: ExecutionLock, now: string): readonly LockIssue[] => {
  if (Date.parse(lock.expiresAt) <= Date.parse(now)) {
    return [
      {
        code: 'release.lock.expired',
        detail: `Execution lock expired at ${lock.expiresAt}.`,
      },
    ]
  }
  return []
}

export const read = (
  path: Fs.Path.AbsFile,
): Effect.Effect<
  Option.Option<ExecutionLock>,
  PlatformError | Schema.SchemaError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(Fs.Path.toString(path))
    if (!exists) return Option.none()
    const text = yield* fs.readFileString(Fs.Path.toString(path))
    const lock = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ExecutionLock))(text)
    return Option.some(lock)
  })

export const write = (
  path: Fs.Path.AbsFile,
  lock: ExecutionLock,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(Fs.Path.toString(Fs.Path.toDir(path)), { recursive: true })
    yield* fs.writeFileString(
      Fs.Path.toString(path),
      `${JSON.stringify(Schema.encodeSync(ExecutionLock)(lock), null, 2)}\n`,
    )
  })

export const acquireLocal = (
  params: LocalLockParams,
): Effect.Effect<
  ExecutionLock,
  Error | PlatformError | Schema.SchemaError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const path = lockPathFor(env.cwd, params.planDigest)
    const existing = yield* read(path)
    if (Option.isSome(existing) && validate(existing.value, params.now).length === 0) {
      return yield* Effect.fail(
        new Error(`Active release lock already exists for ${params.planDigest.value}`),
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
  planDigest: PlanDigest,
): Effect.Effect<void, PlatformError, Env.Env | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const path = lockPathFor(env.cwd, planDigest)
    const exists = yield* fs.exists(Fs.Path.toString(path))
    if (exists) yield* fs.remove(Fs.Path.toString(path))
  })

// oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
export const withLocal = <A, E, R>(
  params: LocalLockParams,
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<
  A,
  // oxlint-disable-next-line kitz/error/require-tagged-error-types -- withLocal preserves the wrapped effect's error channel exactly.
  E | Error | PlatformError | Schema.SchemaError,
  R | Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    yield* acquireLocal(params)
    return yield* effect.pipe(Effect.ensuring(releaseLocal(params.planDigest).pipe(Effect.orDie)))
  })
