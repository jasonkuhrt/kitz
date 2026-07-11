import { Option, Schema as S } from 'effect'
import { Extension } from '../models/Extension.js'
import { FileName } from '../models/FileName.js'

const normalizeExtension = (
  extension: Extension | Option.Option<Extension>,
): Option.Option<Extension> =>
  Option.map(
    Option.isOption(extension) ? extension : Option.some(extension),
    S.decodeSync(Extension),
  )

export const resolveFileName = (
  current: FileName,
  parts: {
    readonly name?: FileName
    readonly stem?: string
    readonly extension?: Extension | Option.Option<Extension>
  },
): FileName => {
  if (parts.name !== undefined) return parts.name

  if (parts.stem !== undefined || parts.extension !== undefined) {
    return FileName.make({
      stem: parts.stem ?? current.stem,
      extension:
        parts.extension === undefined ? current.extension : normalizeExtension(parts.extension),
    })
  }

  return current
}
