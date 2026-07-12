import { Effect, Result, Schema as S, SchemaAST } from 'effect'

type CodecFunction<$Input, $Output> = {
  (input: $Input, options: SchemaAST.ParseOptions | undefined): $Output
  (input: $Input): $Output
}

type ServiceFreeCodec = S.Codec<unknown, unknown, never, never>

export declare namespace withStatics {
  /** The schema-derived `is` guard attached by {@link withStatics}. */
  export type Guard<$Self extends ServiceFreeCodec> = {
    /** Type guard for this schema's values. */
    readonly is: (u: unknown) => u is $Self['Type']
  }

  /** Typed, point-free codec functions pre-applied to the producer schema. */
  export type Codecs<$Self extends ServiceFreeCodec> = {
    readonly decodeSync: CodecFunction<$Self['Encoded'], $Self['Type']>
    readonly encodeSync: CodecFunction<$Self['Type'], $Self['Encoded']>
    readonly decodeEffect: CodecFunction<
      $Self['Encoded'],
      Effect.Effect<$Self['Type'], S.SchemaError>
    >
    readonly encodeEffect: CodecFunction<
      $Self['Type'],
      Effect.Effect<$Self['Encoded'], S.SchemaError>
    >
    readonly decodeResult: CodecFunction<
      $Self['Encoded'],
      Result.Result<$Self['Type'], S.SchemaError>
    >
    readonly encodeResult: CodecFunction<
      $Self['Type'],
      Result.Result<$Self['Encoded'], S.SchemaError>
    >
  }
}

/**
 * Attach a derived `is` type guard and pre-applied Sync, Effect, and Result
 * codec functions so service-free schemas need not declare them individually.
 *
 * Apply it in an `extends` clause — `class X_ extends
 * withStatics(S.asClass(…))` — so the guard is inherited while the exported
 * class remains a named, nameable declaration. This avoids TS7056 declaration
 * emit failures for large inferred schema types.
 */
export const withStatics = <$Self extends ServiceFreeCodec>(
  self: $Self,
): $Self & withStatics.Guard<$Self> & withStatics.Codecs<$Self> => {
  return Object.assign(self, {
    is: S.is(self),
    // Schema classes replace Function.prototype in their static prototype
    // chain; preserve ordinary function source-text coercion without defining
    // a static `toString` that could collide with producer APIs.
    [Symbol.toPrimitive](this: Function) {
      return Function.prototype.toString.call(this)
    },
    decodeSync: S.decodeSync(self),
    encodeSync: S.encodeSync(self),
    decodeEffect: S.decodeEffect(self),
    encodeEffect: S.encodeEffect(self),
    decodeResult: S.decodeResult(self),
    encodeResult: S.encodeResult(self),
  }) as any
}
