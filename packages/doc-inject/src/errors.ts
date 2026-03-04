import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'doc-inject'] as const

/**
 * A `{@include id}` directive references a fragment ID that was not found in the source document.
 */
export const FragmentNotFoundError = Err.TaggedContextualError('DocInjectFragmentNotFoundError', baseTags, {
  context: S.Struct({
    /** The fragment ID that was referenced but not found. */
    fragmentId: S.String,
    /** The file path containing the `{@include}` directive. */
    filePath: S.String,
  }),
  message: (ctx) => `Fragment "${ctx.fragmentId}" referenced in ${ctx.filePath} was not found in the source document`,
})

export type FragmentNotFoundError = InstanceType<typeof FragmentNotFoundError>

/**
 * The source markdown file could not be read.
 */
export const SourceReadError = Err.TaggedContextualError('DocInjectSourceReadError', baseTags, {
  context: S.Struct({
    /** The path to the source file that could not be read. */
    filePath: S.String,
    /** The underlying error detail. */
    detail: S.String,
  }),
  message: (ctx) => `Failed to read source file ${ctx.filePath}: ${ctx.detail}`,
})

export type SourceReadError = InstanceType<typeof SourceReadError>

/**
 * A target file could not be read or written.
 */
export const TargetFileError = Err.TaggedContextualError('DocInjectTargetFileError', baseTags, {
  context: S.Struct({
    /** The path to the target file. */
    filePath: S.String,
    /** The underlying error detail. */
    detail: S.String,
  }),
  message: (ctx) => `Failed to process target file ${ctx.filePath}: ${ctx.detail}`,
})

export type TargetFileError = InstanceType<typeof TargetFileError>

/** Union of all doc-inject errors. */
export type All = FragmentNotFoundError | SourceReadError | TargetFileError
