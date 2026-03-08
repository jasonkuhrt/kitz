type Analyze<T extends string> = {
  readonly input: T
}

export const fromString = <const T extends string>(input: T): Analyze<T> => ({ input })
