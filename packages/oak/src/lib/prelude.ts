export type Index<T> = Record<string, T>

export type RequireField<O extends object, F extends keyof O> = O & {
  [key in F]: Exclude<O[F], undefined | null>
}
