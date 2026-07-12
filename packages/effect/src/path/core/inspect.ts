import * as Inspectable from 'effect/Inspectable'

/** Attach Effect's Node inspect hook without exposing the computed key in class declarations. */
export const attachNodeInspect = <$Self extends { readonly _tag: string; toString(): string }>(
  prototype: object,
): void => {
  Object.defineProperty(prototype, Inspectable.NodeInspectSymbol, {
    value(this: $Self): string {
      return `${this._tag}(${this.toString()})`
    },
  })
}
