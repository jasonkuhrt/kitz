import * as Effect from 'effect/Effect'
import type * as PlatformFileSystem from 'effect/FileSystem'
import * as PlatformError from 'effect/PlatformError'
import * as Schema from 'effect/Schema'
import type { LiteralGuard } from '../../path/core/literal.js'
import * as Path from '../../path/__.js'
import { entrySubject } from '../internal/operand.js'

type ExistsLiteralGuard<$Path extends string> = LiteralGuard<$Path, Path.Any, 'FileSystem.exists'>

/**
 * The typed `exists` method on the FileSystem facade: accepts a decoded
 * `Path.Any` value or a statically validated path literal. Dynamic strings must
 * first be decoded through a Path schema.
 */
export type Exists = {
  <const $Path extends Path.Any | string>(
    path: $Path extends string ? ExistsLiteralGuard<$Path> : $Path,
  ): Effect.Effect<boolean, PlatformError.PlatformError>
}

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

const existsWith = (
  fileSystem: PlatformFileSystem.FileSystem,
  path: Path.Any | string,
): Effect.Effect<boolean, PlatformError.PlatformError> =>
  Effect.flatMap(decodePath(path), (decoded) => fileSystem.exists(entrySubject(decoded)))

/** @internal Bind the typed `exists` method to an already-yielded Effect filesystem. */
export const makeExists = (fileSystem: PlatformFileSystem.FileSystem): Exists =>
  ((path: Path.Any | string) => existsWith(fileSystem, path)) as Exists
