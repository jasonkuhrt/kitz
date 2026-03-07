import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'doc-inject'] as const

const FragmentNotFoundErrorContext = S.Struct({
  /** The fragment ID that was referenced but not found. */
  fragmentId: S.String,
  /** The file path containing the `{@include}` directive. */
  filePath: S.String,
})

/**
 * A `{@include id}` directive references a fragment ID that was not found in the source document.
 */
export const FragmentNotFoundError: Err.TaggedContextualErrorClass<
  'DocInjectFragmentNotFoundError',
  typeof baseTags,
  typeof FragmentNotFoundErrorContext,
  undefined
> = Err.TaggedContextualError('DocInjectFragmentNotFoundError', baseTags, {
  context: FragmentNotFoundErrorContext,
  message: (ctx) =>
    `Fragment "${ctx.fragmentId}" referenced in ${ctx.filePath} was not found in the source document`,
})

export type FragmentNotFoundError = InstanceType<typeof FragmentNotFoundError>

/**
 * The source markdown file could not be read.
 */
const SourceReadErrorContext = S.Struct({
  /** The path to the source file that could not be read. */
  filePath: S.String,
  /** The underlying error detail. */
  detail: S.String,
})

export const SourceReadError: Err.TaggedContextualErrorClass<
  'DocInjectSourceReadError',
  typeof baseTags,
  typeof SourceReadErrorContext,
  undefined
> = Err.TaggedContextualError('DocInjectSourceReadError', baseTags, {
  context: SourceReadErrorContext,
  message: (ctx) => `Failed to read source file ${ctx.filePath}: ${ctx.detail}`,
})

export type SourceReadError = InstanceType<typeof SourceReadError>

/**
 * A target file could not be read or written.
 */
const TargetFileErrorContext = S.Struct({
  /** The path to the target file. */
  filePath: S.String,
  /** The underlying error detail. */
  detail: S.String,
})

export const TargetFileError: Err.TaggedContextualErrorClass<
  'DocInjectTargetFileError',
  typeof baseTags,
  typeof TargetFileErrorContext,
  undefined
> = Err.TaggedContextualError('DocInjectTargetFileError', baseTags, {
  context: TargetFileErrorContext,
  message: (ctx) => `Failed to process target file ${ctx.filePath}: ${ctx.detail}`,
})

export type TargetFileError = InstanceType<typeof TargetFileError>

/** Union of all doc-inject errors. */
export type All = FragmentNotFoundError | SourceReadError | TargetFileError
