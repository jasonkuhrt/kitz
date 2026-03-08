export const parse = (input: string) => Schema.decodeUnknownSync(Pkg.Pin.Exact.FromString)(input)
