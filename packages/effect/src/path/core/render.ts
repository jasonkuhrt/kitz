import { format } from '../analyzer.js'

/** Render canonical path text from normalized path parts. */
export const renderPath = (parts: {
  readonly isPathAbsolute: boolean
  readonly ascent: number
  readonly segments: readonly string[]
  readonly fileName?: string | null
}): string =>
  format({
    isPathAbsolute: parts.isPathAbsolute,
    ascent: parts.ascent,
    fileName: parts.fileName ?? null,
  })(parts.segments)
