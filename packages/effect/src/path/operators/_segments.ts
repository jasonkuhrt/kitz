/**
 * The leading segments common to both arrays — their longest shared prefix.
 * Backs both the shared-base computation and the relative-walk in
 * {@link getSharedBase} and {@link toRel}.
 */
export const commonSegmentPrefix = (a: readonly string[], b: readonly string[]): string[] => {
  const common: string[] = []
  const max = Math.min(a.length, b.length)
  for (let i = 0; i < max && a[i] === b[i]; i++) common.push(a[i]!)
  return common
}
