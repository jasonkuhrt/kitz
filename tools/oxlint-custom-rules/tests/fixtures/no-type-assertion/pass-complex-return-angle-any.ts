const decode = <const T extends string>(
  input: T extends string ? T : never,
): T extends string ? { value: T } : never => {
  return <any>{ value: input }
}

void decode
