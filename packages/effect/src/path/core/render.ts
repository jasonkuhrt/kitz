import { format } from '../analyzer.js'

/** Render canonical path text from normalized path parts. */
export const renderPath = (
  parts: {
    readonly isPathAbsolute: boolean
    readonly ascent: number
    readonly segments: readonly string[]
    readonly fileName?: string | null
  },
  options?: { readonly bare?: boolean },
): string => {
  const canonical = format({
    isPathAbsolute: parts.isPathAbsolute,
    ascent: parts.ascent,
    fileName: parts.fileName ?? null,
  })(parts.segments)

  if (options?.bare !== true) return canonical

  const withoutHerePrefix =
    !parts.isPathAbsolute && parts.ascent === 0 && canonical.startsWith('./')
      ? canonical.slice(2)
      : canonical

  return parts.fileName == null && withoutHerePrefix !== '/' && withoutHerePrefix.endsWith('/')
    ? withoutHerePrefix.slice(0, -1)
    : withoutHerePrefix
}
