import { Ts } from '@kitz/core'
import { Schema as S } from 'effect'
import type { Analyzer } from '../path-analyzer/codec-string/_.js'
import type { $Abs } from './$Abs/_.js'
import type { $Dir } from './$Dir/_.js'
import type { $File } from './$File/_.js'
import type { $Rel } from './$Rel/_.js'
import type { Path } from './_.js'
import { AbsDir } from './AbsDir/_.js'
import { AbsFile } from './AbsFile/_.js'
import { RelDir } from './RelDir/_.js'
import { RelFile } from './RelFile/_.js'

/**
 * Error for when a string must be a literal to be statically parsed.
 */
export interface ErrorStringNotLiteral extends
  Ts.Err.StaticError<
    ['fs', 'path', 'string-not-literal'],
    { message: 'When giving a string, it must be a literal so that it can be statically parsed.' }
  >
{}

/**
 * Error for when path validation fails.
 */
export interface ErrorPathValidation<$tag, $input> extends
  Ts.Err.StaticError<
    ['fs', 'path', 'validation'],
    {
      message: GetValidationError<$tag>['message']
      received: $input
      tip: GetValidationError<$tag>['hint']
    }
  >
{}

/**
 * Error for when input must be a Path type or string.
 */
export interface ErrorMustBePathOrString<$input> extends
  Ts.Err.StaticError<
    ['fs', 'path', 'must-be-path-or-string'],
    {
      message: 'Must be a Path type or string'
      received: $input
    }
  >
{}

/**
 * Input type for Path APIs that accepts either a Path type or a string.
 *
 * When a string is provided, it will be validated at compile time if it's a literal,
 * or at runtime if it's a dynamic value.
 *
 * @example
 * ```ts
 * function processPath<$input extends Input>($input: $input) { ... }
 *
 * // Can accept Path types
 * processPath(AbsFile.make({ segments: ['home', 'user'], fileName: { stem: 'file', extension: '.txt' } }))
 *
 * // Can accept string literals
 * processPath('/path/file.txt')
 * processPath('./relative/path/')
 * ```
 */
export type Input<$path extends Path = Path> = $path | string

/**
 * Namespace containing type aliases for Input types.
 * Provides convenient shortcuts for common Path input constraints.
 */
export namespace Input {
  /**
   * Input that accepts a relative file path.
   */
  export type RelFile = Input<import('./RelFile/_.js').RelFile>

  /**
   * Input that accepts a relative directory path.
   */
  export type RelDir = Input<import('./RelDir/_.js').RelDir>

  /**
   * Input that accepts an absolute file path.
   */
  export type AbsFile = Input<import('./AbsFile/_.js').AbsFile>

  /**
   * Input that accepts an absolute directory path.
   */
  export type AbsDir = Input<import('./AbsDir/_.js').AbsDir>

  /**
   * Input that accepts any file path (absolute or relative).
   */
  export type File = Input<$File>

  /**
   * Input that accepts any directory path (absolute or relative).
   */
  export type Dir = Input<$Dir>

  /**
   * Input that accepts any relative path (file or directory).
   */
  export type Rel = Input<$Rel>

  /**
   * Input that accepts any absolute path (file or directory).
   */
  export type Abs = Input<$Abs>

  /**
   * Input that accepts any Path type.
   */
  export type Any = Input<Path>
}

/**
 * Extended input type that includes validation errors.
 *
 * This type is used internally by validation functions to handle cases where
 * validation fails at compile time. The StaticError type provides helpful
 * error messages to guide users toward correct path formats.
 */
export type InputOrError<$path extends Path = Path> = Input<$path> | Ts.Err.StaticError

/**
 * Validates an input against a target Path type.
 *
 * This type performs compile-time validation when given string literals,
 * ensuring they match the expected path format (absolute/relative, file/directory).
 * If validation fails, it returns a StaticError with helpful hints.
 *
 * @example
 * ```ts
 * // Success: string literal matches target type
 * type Valid = Guard<'/path/file.txt', AbsFile>
 * // Result: '/path/file.txt'
 *
 * // Error: string literal doesn't match target type
 * type Invalid = Guard<'./relative.txt', AbsFile>
 * // Result: StaticError<'Must be an absolute file path', ...>
 * ```
 */
// dprint-ignore
export type Guard<
  $input extends Input,
  $targetPath extends Path,
  ___actualPath extends Path = $input extends string ? FromAnalysis<Analyzer.Analyze<$input>> : $input,
> =
  string extends $input
    ? ErrorStringNotLiteral :
  ___actualPath['_tag'] extends $targetPath['_tag']
    ? $input :
  // else
    ErrorPathValidation<$targetPath['_tag'], $input>

export type FromAnalysis<$analysis extends Analyzer.Analysis> = $analysis extends { _tag: 'file'; pathType: 'absolute' }
  ? AbsFile
  : $analysis extends { _tag: 'file'; pathType: 'relative' } ? RelFile
  : $analysis extends { _tag: 'dir'; pathType: 'absolute' } ? AbsDir
  : $analysis extends { _tag: 'dir'; pathType: 'relative' } ? RelDir
  : never

// dprint-ignore
type GetValidationError<$tag> =
    $tag extends 'FsPathRelFile'                                    ? { message: 'Must be a relative file path'; hint: 'Relative files must not start with / and must have an extension' }
  : $tag extends 'FsPathRelDir'                                     ? { message: 'Must be a relative directory path'; hint: 'Relative directories must not start with / and should end with / or have no extension' }
  : $tag extends 'FsPathAbsDir'                                     ? { message: 'Must be an absolute directory path'; hint: 'Absolute directories must start with / and should end with / or have no extension' }
  : $tag extends 'FsPathAbsFile'                                    ? { message: 'Must be an absolute file path'; hint: 'Absolute files must start with / and have an extension' }
  : $tag extends 'FsPathRelFile' | 'FsPathRelDir'                   ? { message: 'Must be a relative path'; hint: 'Relative paths must not start with /' }
  : $tag extends 'FsPathAbsFile' | 'FsPathAbsDir'                   ? { message: 'Must be an absolute path'; hint: 'Absolute paths must start with /' }
  : $tag extends 'FsPathRelFile' | 'FsPathAbsFile'                  ? { message: 'Must be a file path'; hint: 'Files must have an extension' }
  : $tag extends 'FsPathRelDir' | 'FsPathAbsDir'                    ? { message: 'Must be a directory path'; hint: 'Directories should end with / or have no extension' }
  : { message: 'Must be a valid filesystem location'; hint: 'Check the path format' }

/**
 * Namespace containing type aliases for validating Path inputs.
 * All types accept either the corresponding Path type or a validated string literal.
 */
export namespace Guard {
  /**
   * Validates that input is a relative file path.
   * Relative files must not start with `/` and must have an extension.
   */
  export type RelFile<$input extends Input> = Guard<$input, import('./RelFile/_.js').RelFile>

  /**
   * Validates that input is a relative directory path.
   * Relative directories must not start with `/` and should end with `/` or have no extension.
   */
  export type RelDir<$input extends Input> = Guard<$input, import('./RelDir/_.js').RelDir>

  /**
   * Validates that input is an absolute file path.
   * Absolute files must start with `/` and have an extension.
   */
  export type AbsFile<$input extends Input> = Guard<$input, import('./AbsFile/_.js').AbsFile>

  /**
   * Validates that input is an absolute directory path.
   * Absolute directories must start with `/` and should end with `/` or have no extension.
   */
  export type AbsDir<$input extends Input> = Guard<$input, import('./AbsDir/_.js').AbsDir>

  /**
   * Validates that input is a file path (either absolute or relative).
   */
  export type File<$input extends Input> = Guard<$input, $File>

  /**
   * Validates that input is a directory path (either absolute or relative).
   */
  export type Dir<$input extends Input> = Guard<$input, $Dir>

  /**
   * Validates that input is a relative path (either file or directory).
   */
  export type Rel<$input extends Input> = Guard<$input, $Rel>

  /**
   * Validates that input is an absolute path (either file or directory).
   */
  export type Abs<$input extends Input> = Guard<$input, $Abs>

  /**
   * Accept any Path type OR any string without validation.
   */
  export type Any<$input> = $input extends Path ? $input
    : $input extends string ? $input
    : ErrorMustBePathOrString<$input>
}

// dprint-ignore
export type normalize<$input extends InputOrError> =
  $input extends Ts.Err.StaticError         ? never :
  $input extends string                     ? FromAnalysis<Analyzer.Analyze<$input>> :
                                              $input

export const normalize = <$schema extends S.Schema.All>($schema: $schema) => {
  const decodeSync = S.decodeSync($schema as any)

  return <const $input extends Input<$schema['Type']>>(
    input: Guard<$input, $schema['Type']>,
  ): normalize<$input> => {
    if (typeof input === 'string') {
      return decodeSync(input) as any
    }
    return input as any
  }
}

export const normalizeDynamic = <$schema extends S.Schema.All>($schema: $schema) => {
  const decodeSync = S.decodeSync($schema as any)

  return <const $input extends InputOrError<$schema['Type']>>(
    input: $input,
  ): normalize<$input> => {
    if (typeof input === 'string') {
      return decodeSync(input) as any
    }
    return input as any
  }
}
