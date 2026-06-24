import { Schema as S } from 'effect'
import type { Path } from './_.js'
import { AbsDir } from './models/AbsDir.js'
import { AbsFile } from './models/AbsFile.js'
import type { CodecString as Analyzer } from './path-analyzer/codec-string/_.js'
import { RelDir } from './models/RelDir.js'
import { RelFile } from './models/RelFile.js'
import type { StaticError } from './static-error.js'

/**
 * Error for when a string must be a literal to be statically parsed.
 */
export interface ErrorStringNotLiteral extends StaticError<
  ['fs', 'path', 'string-not-literal'],
  { message: 'When giving a string, it must be a literal so that it can be statically parsed.' }
> {}

/**
 * Error for when path validation fails.
 */
export interface ErrorPathValidation<$tag, $input> extends StaticError<
  ['fs', 'path', 'validation'],
  {
    message: GetValidationError<$tag>['message']
    received: $input
    tip: GetValidationError<$tag>['hint']
  }
> {}

/**
 * Error for when input must be a Path type or string.
 */
export interface ErrorMustBePathOrString<$input> extends StaticError<
  ['fs', 'path', 'must-be-path-or-string'],
  {
    message: 'Must be a Path type or string'
    received: $input
  }
> {}

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
  export type RelFile = Input<import('./models/RelFile.js').RelFile>

  /**
   * Input that accepts a relative directory path.
   */
  export type RelDir = Input<import('./models/RelDir.js').RelDir>

  /**
   * Input that accepts an absolute file path.
   */
  export type AbsFile = Input<import('./models/AbsFile.js').AbsFile>

  /**
   * Input that accepts an absolute directory path.
   */
  export type AbsDir = Input<import('./models/AbsDir.js').AbsDir>

  /**
   * Input that accepts any file path (absolute or relative).
   */
  export type File = Input<import('./models/File.js').File>

  /**
   * Input that accepts any directory path (absolute or relative).
   */
  export type Dir = Input<import('./models/Dir.js').Dir>

  /**
   * Input that accepts any relative path (file or directory).
   */
  export type Rel = Input<import('./models/Rel.js').Rel>

  /**
   * Input that accepts any absolute path (file or directory).
   */
  export type Abs = Input<import('./models/Abs.js').Abs>

  /**
   * Input that accepts any Path type.
   */
  export type Any = Input
}

/**
 * Extended input type that includes validation errors.
 *
 * This type is used internally by validation functions to handle cases where
 * validation fails at compile time. The StaticError type provides helpful
 * error messages to guide users toward correct path formats.
 */
export type InputOrError<$path extends Path = Path> = Input<$path> | StaticError

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
// oxfmt-ignore
export type Guard<
  $input extends Input,
  $targetPath extends Path,
  ___actualPath extends Path = $input extends string ? FromAnalysis<Analyzer.Analyze<$input>> : $input,
> = string extends $input ? ErrorStringNotLiteral
  : ___actualPath['_tag'] extends $targetPath['_tag'] ? $input
  : // else
  ErrorPathValidation<$targetPath['_tag'], $input>

export type FromAnalysis<$analysis extends Analyzer.Analysis> = $analysis extends {
  _tag: 'file'
  pathType: 'absolute'
}
  ? AbsFile
  : $analysis extends { _tag: 'file'; pathType: 'relative' }
    ? RelFile
    : $analysis extends { _tag: 'dir'; pathType: 'absolute' }
      ? AbsDir
      : $analysis extends { _tag: 'dir'; pathType: 'relative' }
        ? RelDir
        : never

// oxfmt-ignore
type GetValidationError<$tag> = $tag extends 'RelFile'
  ? { message: 'Must be a relative file path'; hint: 'Relative files must not start with / and must have an extension' }
  : $tag extends 'RelDir'
    ? {
      message: 'Must be a relative directory path'
      hint: 'Relative directories must not start with / and should end with / or have no extension'
    }
  : $tag extends 'AbsDir'
    ? {
      message: 'Must be an absolute directory path'
      hint: 'Absolute directories must start with / and should end with / or have no extension'
    }
  : $tag extends 'AbsFile'
    ? { message: 'Must be an absolute file path'; hint: 'Absolute files must start with / and have an extension' }
  : $tag extends 'RelFile' | 'RelDir'
    ? { message: 'Must be a relative path'; hint: 'Relative paths must not start with /' }
  : $tag extends 'AbsFile' | 'AbsDir'
    ? { message: 'Must be an absolute path'; hint: 'Absolute paths must start with /' }
  : $tag extends 'RelFile' | 'AbsFile'
    ? { message: 'Must be a file path'; hint: 'Files must have an extension' }
  : $tag extends 'RelDir' | 'AbsDir'
    ? { message: 'Must be a directory path'; hint: 'Directories should end with / or have no extension' }
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
  export type RelFile<$input extends Input> = Guard<$input, import('./models/RelFile.js').RelFile>

  /**
   * Validates that input is a relative directory path.
   * Relative directories must not start with `/` and should end with `/` or have no extension.
   */
  export type RelDir<$input extends Input> = Guard<$input, import('./models/RelDir.js').RelDir>

  /**
   * Validates that input is an absolute file path.
   * Absolute files must start with `/` and have an extension.
   */
  export type AbsFile<$input extends Input> = Guard<$input, import('./models/AbsFile.js').AbsFile>

  /**
   * Validates that input is an absolute directory path.
   * Absolute directories must start with `/` and should end with `/` or have no extension.
   */
  export type AbsDir<$input extends Input> = Guard<$input, import('./models/AbsDir.js').AbsDir>

  /**
   * Validates that input is a file path (either absolute or relative).
   */
  export type File<$input extends Input> = Guard<$input, import('./models/File.js').File>

  /**
   * Validates that input is a directory path (either absolute or relative).
   */
  export type Dir<$input extends Input> = Guard<$input, import('./models/Dir.js').Dir>

  /**
   * Validates that input is a relative path (either file or directory).
   */
  export type Rel<$input extends Input> = Guard<$input, import('./models/Rel.js').Rel>

  /**
   * Validates that input is an absolute path (either file or directory).
   */
  export type Abs<$input extends Input> = Guard<$input, import('./models/Abs.js').Abs>

  /**
   * Accept any Path type OR any string without validation.
   */
  export type Any<$input> = $input extends Path
    ? $input
    : $input extends string
      ? $input
      : ErrorMustBePathOrString<$input>
}

// oxfmt-ignore
export type normalize<$input extends InputOrError> = $input extends StaticError ? never
  : $input extends string ? FromAnalysis<Analyzer.Analyze<$input>>
  : $input

export const normalize = <$schema extends S.Top>($schema: $schema) => {
  const decodeSync = S.decodeSync($schema as any)

  return <const $input extends Input>(input: Guard<$input, any>): normalize<$input> => {
    if (typeof input === 'string') {
      return decodeSync(input)
    }
    return input as any
  }
}

export const normalizeDynamic = <$schema extends S.Top>($schema: $schema) => {
  const decodeSync = S.decodeSync($schema as any)

  return <const $input extends InputOrError>(input: $input): normalize<$input> => {
    if (typeof input === 'string') {
      return decodeSync(input)
    }
    return input as any
  }
}
