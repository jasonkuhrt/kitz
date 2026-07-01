import type { Option } from 'effect'
import type { Extension } from '../models/Extension.js'
import type { File } from '../models/File.js'

/**
 * A file's extension (with leading dot) as an {@link Option}, or `None` for an
 * extension-less file.
 *
 * @example
 * ```ts
 * getExtension(AbsFile '/a/file.txt') // Option.some('.txt')
 * getExtension(AbsFile '/a/README')   // Option.none()
 * ```
 */
export const getExtension = (file: File): Option.Option<Extension> => file.fileName.extension
