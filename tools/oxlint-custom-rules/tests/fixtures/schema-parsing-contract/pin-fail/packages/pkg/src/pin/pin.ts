type Exact = {
  readonly value: string
}

export const fromString = (input: string): Exact => ({ value: input })
