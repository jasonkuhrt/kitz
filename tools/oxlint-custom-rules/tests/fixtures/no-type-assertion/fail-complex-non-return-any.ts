const decode = <const T extends string>(
  input: T extends string ? T : never,
): T extends string ? { value: T } : never => {
  const value = input as any
  return { value } as any
}

void decode
