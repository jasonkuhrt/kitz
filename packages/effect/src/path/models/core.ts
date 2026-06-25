/**
 * Count of leading parent-traversal (`..`) steps in a segment list.
 *
 * Shared by the relative path value classes; absolute paths can't lead with `..`,
 * so they simply don't expose `back`. Typed structurally on `_tag` to avoid a
 * `core` ⇄ `Segment` import cycle.
 */
export const back = (segments: readonly { readonly _tag: string }[]): number => {
  let count = 0
  for (const segment of segments) {
    if (segment._tag === 'Up') count++
    else break
  }
  return count
}
