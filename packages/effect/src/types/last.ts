/** The final element of a tuple, or `never` for an empty tuple. */
export type Last<$Tuple extends readonly unknown[]> = $Tuple extends readonly [
  ...unknown[],
  infer $Last,
]
  ? $Last
  : never
