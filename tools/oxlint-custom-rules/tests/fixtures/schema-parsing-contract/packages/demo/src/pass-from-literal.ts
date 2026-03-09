type Analyze<T extends string> = {
  readonly input: T
}

export const fromString = <const T extends string>(input: T): Analyze<T> => ({ input })

export const fromLiteral = <const T extends string>(input: T): Analyze<T> => fromString(input)
