export const parse = (input: string) => {
  const [name, version] = input.split(`@`)
  return { name, version }
}
