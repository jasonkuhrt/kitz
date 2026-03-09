import { Err } from '@kitz/core'
import { Fs } from '@kitz/fs'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'resource'] as const
const renderPath = (path: Fs.Path.AbsFile): string => Fs.Path.toString(path)
const ResourceErrorContext = S.Struct({
  /** Path to the file */
  path: Fs.Path.AbsFile.Schema,
  /** Details about the failure */
  detail: S.String,
})
const ResourceNotFoundContext = S.Struct({
  /** Path to the file */
  path: Fs.Path.AbsFile.Schema,
})

/**
 * Failed to read the resource file.
 */
export const ReadError: Err.TaggedContextualErrorClass<
  'ResourceReadError',
  typeof baseTags,
  typeof ResourceErrorContext,
  undefined
> = Err.TaggedContextualError('ResourceReadError', baseTags, {
  context: ResourceErrorContext,
  message: (ctx) => `Failed to read ${renderPath(ctx.path)}: ${ctx.detail}`,
})

export type ReadError = InstanceType<typeof ReadError>

/**
 * Failed to write the resource file.
 */
export const WriteError: Err.TaggedContextualErrorClass<
  'ResourceWriteError',
  typeof baseTags,
  typeof ResourceErrorContext,
  undefined
> = Err.TaggedContextualError('ResourceWriteError', baseTags, {
  context: ResourceErrorContext,
  message: (ctx) => `Failed to write ${renderPath(ctx.path)}: ${ctx.detail}`,
})

export type WriteError = InstanceType<typeof WriteError>

/**
 * Failed to parse the resource content.
 */
export const ParseError: Err.TaggedContextualErrorClass<
  'ResourceParseError',
  typeof baseTags,
  typeof ResourceErrorContext,
  undefined
> = Err.TaggedContextualError('ResourceParseError', baseTags, {
  context: ResourceErrorContext,
  message: (ctx) => `Failed to parse ${renderPath(ctx.path)}: ${ctx.detail}`,
})

export type ParseError = InstanceType<typeof ParseError>

/**
 * Failed to encode the resource for writing.
 */
export const EncodeError: Err.TaggedContextualErrorClass<
  'ResourceEncodeError',
  typeof baseTags,
  typeof ResourceErrorContext,
  undefined
> = Err.TaggedContextualError('ResourceEncodeError', baseTags, {
  context: ResourceErrorContext,
  message: (ctx) => `Failed to encode ${renderPath(ctx.path)}: ${ctx.detail}`,
})

export type EncodeError = InstanceType<typeof EncodeError>

/**
 * Resource file not found when it was required.
 */
export const NotFoundError: Err.TaggedContextualErrorClass<
  'ResourceNotFoundError',
  typeof baseTags,
  typeof ResourceNotFoundContext,
  undefined
> = Err.TaggedContextualError('ResourceNotFoundError', baseTags, {
  context: ResourceNotFoundContext,
  message: (ctx) => `Resource not found: ${renderPath(ctx.path)}`,
})

export type NotFoundError = InstanceType<typeof NotFoundError>

/** Union of all resource errors */
export type All = ReadError | WriteError | ParseError | EncodeError | NotFoundError
