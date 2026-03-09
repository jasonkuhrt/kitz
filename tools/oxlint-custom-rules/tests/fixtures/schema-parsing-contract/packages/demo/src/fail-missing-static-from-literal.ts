type Analyze<T extends string> = {
  readonly input: T
}

export class Parser {
  static fromString = <const T extends string>(input: T): Analyze<T> => ({ input })
}
