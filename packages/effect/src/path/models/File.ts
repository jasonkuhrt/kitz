import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import { withLiteralStatics } from '../core/statics.js'
import type { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'
import type { Dir } from './Dir.js'
import type { RelDir } from './RelDir.js'
import { RelFile } from './RelFile.js'

type FileForDir<$Base extends Dir> = $Base extends AbsDir
  ? AbsFile
  : $Base extends RelDir
    ? RelFile
    : never

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 * Carries tagged-union utilities keyed by `_tag`: `cases`, `guards`, `isAnyOf`, `match`.
 */
const FileTaggedUnion = S.Union([AbsFile, RelFile]).pipe(S.toTaggedUnion('_tag'))

class File_ extends withLiteralStatics(
  withStatics(
    S.asClass(FileTaggedUnion.pipe(S.overrideToFormatter(() => (path) => path.toString()))),
  ),
  'Path.File.make',
) {
  static readonly cases = FileTaggedUnion.cases
  static readonly guards = FileTaggedUnion.guards
  static readonly isAnyOf = FileTaggedUnion.isAnyOf
  static readonly match = FileTaggedUnion.match

  /** Build a file from a base dir, optional dynamic segments, and a validated name. */
  static readonly join: {
    <$Base extends Dir>(base: $Base, name: string): FileForDir<$Base>
    <$Base extends Dir>(base: $Base, segments: Iterable<string>, name: string): FileForDir<$Base>
  } = ((base: Dir, segmentsOrName: Iterable<string> | string, name?: string): typeof File_.Type =>
    base._tag === 'AbsDir'
      ? name === undefined
        ? AbsFile.join(base, segmentsOrName as any)
        : AbsFile.join(base, segmentsOrName as any, name)
      : name === undefined
        ? RelFile.join(base, segmentsOrName as any)
        : RelFile.join(base, segmentsOrName as any, name)) as any
}

export const File = File_
export type File = typeof File_.Type
