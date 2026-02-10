import { Cause, Schema as S } from 'effect'

// =============================================================================
// Types
// =============================================================================

/**
 * Shape of errors created by TaggedContextualError factory.
 */
export interface TaggedContextualErrorLike {
  readonly _tag: string
  readonly tags: readonly string[]
}

/**
 * Extract errors from a union that have a specific tag.
 *
 * @example
 * ```typescript
 * type AllErrors = InputError | FatalError | OtherError
 * type InputErrors = ErrorsWithTag<AllErrors, 'input'>
 * // => InputError (if it has tags: ['input', ...])
 * ```
 */
export type ErrorsWithTag<$Errors, $Tag extends string> = $Errors extends TaggedContextualErrorLike
  ? $Tag extends $Errors['tags'][number] ? $Errors
  : never
  : never

/**
 * Configuration for creating a contextual error.
 */
export interface TaggedContextualErrorConfig<
  ContextSchema extends S.Schema.Any,
  CauseSchema extends S.Schema.Any | undefined = undefined,
> {
  /**
   * Schema defining the context structure.
   * Type is inferred from the schema - no need for generic type params.
   *
   * @example
   * ```typescript
   * context: Schema.Struct({
   *   path: Fs.Path.AbsDir,
   *   resource: Schema.String,
   * })
   * ```
   */
  context: ContextSchema
  /**
   * Function to derive the error message from context.
   * The context type is inferred from the schema.
   */
  message: (context: S.Schema.Type<ContextSchema>) => string
  /**
   * Optional schema for constraining the cause type.
   */
  cause?: CauseSchema
}

/**
 * Instance type of a TaggedContextualError class.
 */
export interface TaggedContextualErrorInstance<
  $Tag extends string,
  $Tags extends readonly string[],
  $Context extends Record<string, unknown>,
  $Cause extends Error | undefined,
> extends Cause.YieldableError {
  readonly _tag: $Tag
  readonly tags: $Tags
  readonly context: $Context
  readonly cause: $Cause
}

/**
 * Constructor type returned by TaggedContextualError factory.
 */
export interface TaggedContextualErrorClass<
  $Tag extends string,
  $Tags extends readonly string[],
  ContextSchema extends S.Schema.Any,
  CauseSchema extends S.Schema.Any | undefined,
> extends
  // eslint-disable-next-line import/namespace -- Effect Schema types expose nested members via namespace.
  S.Schema<
    TaggedContextualErrorInstance<
      $Tag,
      $Tags,
      S.Schema.Type<ContextSchema>,
      CauseSchema extends S.Schema.Any ? S.Schema.Type<CauseSchema> : Error | undefined
    >,
    {
      readonly _tag: $Tag
      readonly context: S.Schema.Encoded<ContextSchema>
      readonly cause?: CauseSchema extends S.Schema.Any ? S.Schema.Encoded<CauseSchema> : unknown
    },
    S.Schema.Context<ContextSchema> | (CauseSchema extends S.Schema.Any ? S.Schema.Context<CauseSchema> : never)
  >
{
  readonly _tag: $Tag
  readonly tags: $Tags

  new(
    args:
      & {
        context: S.Schema.Type<ContextSchema>
      }
      & (CauseSchema extends S.Schema.Any ? { cause?: S.Schema.Type<CauseSchema> }
        : { cause?: Error }),
  ): TaggedContextualErrorInstance<
    $Tag,
    $Tags,
    S.Schema.Type<ContextSchema>,
    CauseSchema extends S.Schema.Any ? S.Schema.Type<CauseSchema> : Error | undefined
  >
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Factory for creating tagged contextual error classes.
 *
 * Creates Schema-compatible error classes with:
 * - Category tags for filtering errors by domain
 * - Typed context with full schema encoding support
 * - Automatic message derivation from context
 * - Optional cause type constraints
 *
 * @example
 * ```typescript
 * import { Err } from '@kitz/core'
 * import { Fs } from '@kitz/fs'
 * import { Schema as S } from 'effect'
 *
 * const FileNotFound = Err.TaggedContextualError('ResourceFileNotFound', ['kit', 'resource'], {
 *   context: S.Struct({
 *     path: Fs.Path.AbsDir,      // Rich type preserved!
 *     resource: S.String,
 *   }),
 *   message: (ctx) => `${ctx.resource} not found at ${Fs.Path.toString(ctx.path)}`,
 * })
 *
 * // Usage
 * throw new FileNotFound({
 *   context: { path: somePath, resource: 'package.json' },
 * })
 *
 * // Works in Schema.Union for workflow error handling
 * const WorkflowError = S.Union(FileNotFound, OtherError)
 * ```
 *
 * @example
 * ```typescript
 * // Filter errors by category tag
 * import { Err } from '@kitz/core'
 *
 * type AllErrors = FileNotFound | NetworkError | ValidationError
 * type ResourceErrors = Err.ErrorsWithTag<AllErrors, 'resource'>
 * // => FileNotFound (if it has 'resource' in tags)
 * ```
 */
export const TaggedContextualError = <
  const $Tag extends string,
  const $Tags extends readonly string[],
  ContextSchema extends S.Schema.Any,
  CauseSchema extends S.Schema.Any | undefined = undefined,
>(
  tag: $Tag,
  tags: $Tags,
  config: TaggedContextualErrorConfig<ContextSchema, CauseSchema>,
): TaggedContextualErrorClass<$Tag, $Tags, ContextSchema, CauseSchema> => {
  // Cast to any so class extension works (same pattern as Effect's makeClass)
  const Base = S.TaggedError<any>()(tag, {
    context: config.context,
    cause: config.cause ?? S.optional(S.Unknown),
  }) as any

  return class extends Base {
    static tags = tags
    readonly tags = tags

    get message(): string {
      return config.message(this['context'])
    }
  } as any
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for narrowing errors by tag.
 *
 * @example
 * ```typescript
 * if (hasTag(error, 'fatal')) {
 *   // error is narrowed to errors with 'fatal' in their tags
 * }
 * ```
 */
export const hasTag = <
  $Error extends TaggedContextualErrorLike,
  $Tag extends string,
>(
  error: $Error,
  tag: $Tag,
): error is ErrorsWithTag<$Error, $Tag> => {
  return error.tags.includes(tag)
}
