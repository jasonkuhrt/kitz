/** The final element of a tuple, or `never` for an empty tuple. */
export type Last<$Tuple extends readonly unknown[]> = $Tuple extends readonly []
  ? never
  : $Tuple extends readonly [...unknown[], infer $Last]
    ? $Last
    : number extends $Tuple['length']
      ? $Tuple[number]
      : $Tuple extends readonly [...infer $Init, (infer $Last)?]
        ? Last<$Init> | $Last
        : never
