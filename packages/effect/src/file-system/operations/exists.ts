import * as Effect from 'effect/Effect'
import * as FileSystemEffect from 'effect/FileSystem'
import * as PlatformError from 'effect/PlatformError'
import * as Schema from 'effect/Schema'
import type { LiteralGuard } from '../../path/core/literal.js'
import * as Path from '../../path/__.js'
import { entrySubject } from '../internal/operand.js'

type ExistsLiteralGuard<$Path extends string> = LiteralGuard<$Path, Path.Any, 'FileSystem.exists'>

/**
 * `exists`, parameterized by its requirements channel. The top-level operation
 * requires Effect's `FileSystem`; the bound façade has it discharged. Writing
 * the two as one generic type — rather than deriving the façade with an
 * `(...args: infer A) => …` transform — keeps the literal-duality type
 * parameter intact, which such a transform would collapse to its broad
 * signature.
 */
type ExistsIn<$Services> = {
  <const $Path extends Path.Any | string>(
    path: $Path extends string ? ExistsLiteralGuard<$Path> : $Path,
  ): Effect.Effect<boolean, PlatformError.PlatformError, $Services>
}

/**
 * The typed `exists` operation: accepts a decoded `Path.Any` value or a
 * statically validated path literal, and requires Effect's `FileSystem`.
 * Dynamic strings must first be decoded through a Path schema.
 */
export type Exists = ExistsIn<FileSystemEffect.FileSystem>

/** `exists` bound to an already-resolved service — requirements discharged. */
export type ExistsBound = ExistsIn<never>

const decodePath = (
  path: Path.Any | string,
): Effect.Effect<Path.Any, PlatformError.PlatformError> =>
  typeof path === 'string'
    ? Schema.decodeEffect(Path.Any)(path).pipe(
        Effect.mapError((cause) =>
          PlatformError.badArgument({
            module: 'FileSystem',
            method: 'exists',
            description: 'path is not a valid Kitz Path value',
            cause,
          }),
        ),
      )
    : Effect.succeed(path)

/**
 * Bind `exists` to a resolved Effect `FileSystem`. Kitz decodes the Path and
 * desugars it to the operand spelling the syscall expects; the existence
 * semantics themselves are the upstream service's, never re-derived here.
 */
export const bindExists = (fileSystem: FileSystemEffect.FileSystem): ExistsBound =>
  ((path: Path.Any | string) =>
    Effect.flatMap(decodePath(path), (decoded) =>
      fileSystem.exists(entrySubject(decoded)),
    )) as ExistsBound

/** The top-level `exists` operation, dispatching to the native Effect service. */
export const exists: Exists = ((path: Path.Any | string) =>
  Effect.flatMap(FileSystemEffect.FileSystem, (fileSystem) =>
    bindExists(fileSystem)(path as never),
  )) as Exists
