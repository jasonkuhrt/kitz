const decode = <const T extends string>(
  input: T extends string ? T : never,
): T extends string ? { value: T } : never => {
  return ((value: unknown) => ({ value }))(input as any) as any
}

void decode
