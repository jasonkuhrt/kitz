import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'resource'] as const

/**
 * Failed to read the resource file.
 */
export const ReadError = Err.TaggedContextualError('ResourceReadError', baseTags, {
  context: S.Struct({
    /** Path to the file */
    path: Fs.Path.AbsFile.Schema,
    /** Details about the failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to read ${ctx.path}: ${ctx.detail}`,
})

export type ReadError = InstanceType<typeof ReadError>

/**
 * Failed to write the resource file.
 */
export const WriteError = Err.TaggedContextualError('ResourceWriteError', baseTags, {
  context: S.Struct({
    /** Path to the file */
    path: Fs.Path.AbsFile.Schema,
    /** Details about the failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to write ${ctx.path}: ${ctx.detail}`,
})

export type WriteError = InstanceType<typeof WriteError>

/**
 * Failed to parse the resource content.
 */
export const ParseError = Err.TaggedContextualError('ResourceParseError', baseTags, {
  context: S.Struct({
    /** Path to the file */
    path: Fs.Path.AbsFile.Schema,
    /** Details about the parse failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to parse ${ctx.path}: ${ctx.detail}`,
})

export type ParseError = InstanceType<typeof ParseError>

/**
 * Failed to encode the resource for writing.
 */
export const EncodeError = Err.TaggedContextualError('ResourceEncodeError', baseTags, {
  context: S.Struct({
    /** Path to the file */
    path: Fs.Path.AbsFile.Schema,
    /** Details about the encode failure */
    detail: S.String,
  }),
  message: (ctx) => `Failed to encode ${ctx.path}: ${ctx.detail}`,
})

export type EncodeError = InstanceType<typeof EncodeError>

/**
 * Resource file not found when it was required.
 */
export const NotFoundError = Err.TaggedContextualError('ResourceNotFoundError', baseTags, {
  context: S.Struct({
    /** Path to the file */
    path: Fs.Path.AbsFile.Schema,
  }),
  message: (ctx) => `Resource not found: ${ctx.path}`,
})

export type NotFoundError = InstanceType<typeof NotFoundError>

/** Union of all resource errors */
export type All = ReadError | WriteError | ParseError | EncodeError | NotFoundError
