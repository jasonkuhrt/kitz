import { Schema as S } from 'effect'

export declare namespace withStatics {
  /** The schema-derived `is` guard attached by {@link withStatics}. */
  export type Guard<$Self extends S.Top> = {
    /** Type guard for this schema's values. */
    readonly is: (u: unknown) => u is $Self['Type']
  }
}

/**
 * Attach a derived `is` type guard so schemas need not declare one individually.
 *
 * Apply it in an `extends` clause — `class X_ extends
 * withStatics(S.asClass(…))` — so the guard is inherited while the exported
 * class remains a named, nameable declaration. This avoids TS7056 declaration
 * emit failures for large inferred schema types.
 */
export const withStatics = <$Self extends S.Top>(self: $Self): $Self & withStatics.Guard<$Self> =>
  Object.assign(self, { is: S.is(self) })
