import { Err } from '@kitz/core'
import { Schema as S } from 'effect'
import type { OpeningArgs } from '../OpeningArgs/_.js'
import type { ParameterExclusive, ParameterExclusiveGroup } from '../Parameter/exclusive.js'
import type { Parameter } from '../Parameter/types.js'

export namespace Global {
  const baseTags = ['oak', 'input'] as const

  export const ErrorUnknownParameterViaEnvironment = Err.TaggedContextualError(
    'OakErrorUnknownParameterViaEnvironment',
    [...baseTags, 'environment'],
    {
      context: S.Struct({
        flagName: S.String,
        prefix: S.NullOr(S.String),
      }),
      message: (ctx) => `Unknown parameter via environment: "${ctx.flagName}"`,
    },
  )

  export const ErrorUnknownFlag = Err.TaggedContextualError(
    'OakErrorUnknownFlag',
    [...baseTags, 'flag'],
    {
      context: S.Struct({
        flagName: S.String,
      }),
      message: (ctx) => `Unknown flag "${ctx.flagName}"`,
    },
  )
}

const baseTags = ['oak', 'input'] as const

export const ErrorDuplicateLineArg = Err.TaggedContextualError(
  'OakErrorDuplicateLineArg',
  [...baseTags, 'flag'],
  {
    context: S.Struct({
      parameter: S.Unknown as S.Schema<Parameter>,
      flagName: S.String,
    }),
    message: (ctx) => `The parameter "${ctx.flagName}" was passed an argument multiple times via flags.`,
  },
)

export const ErrorDuplicateEnvArg = Err.TaggedContextualError(
  'OakErrorDuplicateEnvArg',
  [...baseTags, 'environment'],
  {
    context: S.Struct({
      parameter: S.Unknown as S.Schema<Parameter>,
      instances: S.Array(S.Struct({
        value: S.String,
        name: S.String,
        prefix: S.NullOr(S.String),
      })),
    }),
    message: (ctx) =>
      `The parameter "${ctx.parameter.name.canonical}" was passed an argument multiple times via different parameter aliases in the environment.`,
  },
)

export const ErrorFailedToGetDefaultArgument = Err.TaggedContextualError(
  'OakErrorFailedToGetDefaultArgument',
  ['oak', 'argument', 'default'],
  {
    context: S.Struct({
      spec: S.Unknown as S.Schema<Parameter>,
    }),
    message: (ctx) => `Failed to get default value for ${ctx.spec.name.canonical}`,
  },
)

export const ErrorMissingArgument = Err.TaggedContextualError(
  'OakErrorMissingArgument',
  [...baseTags, 'argument'],
  {
    context: S.Struct({
      parameter: S.Unknown as S.Schema<Parameter>,
    }),
    message: (ctx) => `Missing argument for flag "${ctx.parameter.name.canonical}".`,
  },
)

export const ErrorMissingArgumentForMutuallyExclusiveParameters = Err.TaggedContextualError(
  'OakErrorMissingArgumentForMutuallyExclusiveParameters',
  [...baseTags, 'argument'],
  {
    context: S.Struct({
      group: S.Unknown as S.Schema<ParameterExclusiveGroup>,
    }),
    message: (ctx) =>
      `Missing argument for one of the following parameters: ${
        Object.values(ctx.group.parameters)
          .map((_) => _.name.canonical)
          .join(`, `)
      }`,
  },
)

export const ErrorArgumentsToMutuallyExclusiveParameters = Err.TaggedContextualError(
  'OakErrorArgumentsToMutuallyExclusiveParameters',
  [...baseTags, 'argument'],
  {
    context: S.Struct({
      group: S.Unknown as unknown as S.Schema<ParameterExclusiveGroup>,
      offenses: S.Array(S.Unknown) as unknown as S.Schema<{ spec: ParameterExclusive; arg: OpeningArgs.Argument }[]>,
    }),
    message: (ctx) =>
      `Arguments given to multiple mutually exclusive parameters: ${
        ctx.offenses
          .map((_) => _.spec.name.canonical)
          .join(`, `)
      }`,
  },
)

export const ErrorInvalidArgument = Err.TaggedContextualError(
  'OakErrorInvalidArgument',
  [...baseTags, 'validation'],
  {
    context: S.Struct({
      spec: S.Unknown as S.Schema<Parameter>,
      value: S.Unknown,
      validationErrors: S.Array(S.String),
      environmentVariableName: S.optional(S.String),
    }),
    message: (ctx) =>
      ctx.environmentVariableName
        ? `Invalid argument (via environment variable "${ctx.environmentVariableName}") for parameter: "${ctx.spec.name.canonical}". The error was:\n${
          ctx.validationErrors.join(`\n`)
        }`
        : `Invalid argument for parameter: "${ctx.spec.name.canonical}". The error was:\n${
          ctx.validationErrors.join(`\n`)
        }`,
  },
)
