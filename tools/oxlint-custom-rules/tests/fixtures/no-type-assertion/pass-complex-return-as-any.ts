const decode = <const T extends string>(
  input: T extends string ? T : never,
): T extends string ? { value: T } : never => {
  return { value: input } as any
}

void decode
