import { Option } from 'effect'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'

/** The optional extension returned for a path variant. Directories always return `None`. */
export type ExtensionOf<$P extends Any> = $P extends File
  ? Option.Option<Extension>
  : $P extends Dir
    ? Option.Option<never>
    : never

/**
 * Return a file's final extension, or `None` for every directory. The return
 * distributes over path variants.
 */
export const extension = <$P extends Any>(path: $P): ExtensionOf<$P> => {
  const value: Any = path
  const result: Option.Option<Extension> =
    value._tag === 'AbsFile' || value._tag === 'RelFile' ? value.extension : Option.none()
  return result as any
}
