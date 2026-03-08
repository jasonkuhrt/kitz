namespace S {
  export type Schema<A, I> = {
    readonly decode: (input: I) => A
  }
}

type Exact = {
  readonly value: string
}

type ParsePin<T extends string> = Exact & {
  readonly input: T
}

export class Pin {
  static FromString: S.Schema<Exact, string> = {
    decode: (input) => ({ value: input }),
  }
}

export const fromString = <const T extends string>(input: T): ParsePin<T> => ({
  value: input,
  input,
})

export const fromLiteral = <const T extends string>(input: T): ParsePin<T> => fromString(input)
