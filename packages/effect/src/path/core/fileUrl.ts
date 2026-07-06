import { Schema as S } from 'effect'
import { format } from '../analyzer.js'
import type { FileName } from '../models/FileName.js'
import { Protocol } from '../models/Protocol.js'

const fileScheme = S.encodeSync(Protocol)('file')

/** Build a `file://` URL from raw absolute-path data. Kitz paths are POSIX-only. */
export const fileUrlOf = (parts: {
  readonly segments: readonly string[]
  readonly fileName?: FileName
}): URL =>
  new URL(
    `${fileScheme}${format({
      isPathAbsolute: true,
      back: 0,
      fileName: parts.fileName?.name ?? null,
    })(parts.segments)}`,
  )
