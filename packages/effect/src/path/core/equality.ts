import { Equal, Hash } from 'effect'

const pathTags = new Set(['AbsDir', 'AbsFile', 'RelDir', 'RelFile'])

const isPathLike = (
  value: Equal.Equal,
): value is Equal.Equal & { readonly _tag: string; toString(): string } =>
  typeof value === 'object' &&
  value !== null &&
  '_tag' in value &&
  typeof value._tag === 'string' &&
  pathTags.has(value._tag) &&
  typeof value.toString === 'function'

/** Attach canonical-string equality/hash without exposing computed keys in class declarations. */
export const attachPathEqual = <$Self extends { readonly _tag: string; toString(): string }>(
  prototype: object,
): void => {
  Object.defineProperties(prototype, {
    [Equal.symbol]: {
      value(this: $Self, that: Equal.Equal): boolean {
        return isPathLike(that) && this.toString() === that.toString()
      },
    },
    [Hash.symbol]: {
      value(this: $Self): number {
        return Hash.string(this.toString())
      },
    },
  })
}
