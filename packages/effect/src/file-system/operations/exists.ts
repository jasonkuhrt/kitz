import * as Effect from 'effect/Effect'
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

/** A backend's existence check over a canonical POSIX path string. */
export type ExistsCheck = (path: string) => Effect.Effect<boolean, PlatformError.PlatformError>

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
 * Build the typed `exists` method from a backend existence check. The Path
 * decoding and canonical-string encoding are shared; each backend supplies only
 * the check over the encoded path string.
 */
export const makeExists = (check: ExistsCheck): Exists =>
  ((path: Path.Any | string) =>
    Effect.flatMap(decodePath(path), (decoded) => check(entrySubject(decoded)))) as Exists
