import { type Option } from 'effect'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import type { File } from '../models/File.js'

/** The name result returned for a path variant. */
export type NameOf<$P extends Any> = $P extends File
  ? string
  : $P extends Dir
    ? Option.Option<string>
    : never

/**
 * Return a file's filename or a directory's optional final segment. Directory
 * anchors have no name. The return distributes over path variants.
 */
export const name = <$P extends Any>(path: $P): NameOf<$P> => {
  const value: Any = path
  const result: string | Option.Option<string> = value.name
  return result as any
}
