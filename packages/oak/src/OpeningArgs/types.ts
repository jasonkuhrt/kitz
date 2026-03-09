import type { Errors } from '../Errors/_.js'
import type { ArgumentValue, ArgumentValueMutuallyExclusive } from '../executor/types.js'
import type { ParameterBasic } from '../Parameter/basic.js'
import type { ParameterExclusive, ParameterExclusiveGroup } from '../Parameter/exclusive.js'
import type { Parameter } from '../Parameter/types.js'
import type { Environment } from './Environment/_.js'
import type { Line } from './Line/_.js'

export interface EnvironmentArgumentReport<
  $Parameter extends Parameter = Parameter,
> extends Argument {
  parameter: $Parameter
  errors: Environment.LocalParseErrors[]
}

export interface ArgumentReport<$Parameter extends Parameter = Parameter> extends Argument {
  parameter: $Parameter
  errors: Line.LocalParseErrors[]
}

export interface Argument {
  value: Value
  source: ArgumentSource
}

export type Value =
  | { _tag: 'boolean'; value: boolean; negated: boolean }
  | { _tag: 'number'; value: number }
  | { _tag: 'string'; value: string }
  | { _tag: 'undefined'; value: undefined }

type ArgumentSource = LineSource | EnvironmentSource

interface LineSource {
  _tag: 'line'
  name: string
}

interface EnvironmentSource {
  _tag: 'environment'
  name: string
  namespace: null | string
}

export type ParseErrorGlobal =
  | InstanceType<typeof Errors.Global.ErrorUnknownFlag>
  | InstanceType<typeof Errors.Global.ErrorUnknownParameterViaEnvironment>

export type ParseErrorBasic =
  | InstanceType<typeof Errors.ErrorMissingArgument>
  | InstanceType<typeof Errors.ErrorInvalidArgument>
  | InstanceType<typeof Errors.ErrorFailedToGetDefaultArgument>
  | InstanceType<typeof Errors.ErrorDuplicateEnvArg>
  | InstanceType<typeof Errors.ErrorDuplicateLineArg>

export type ParseErrorExclusiveGroup =
  | InstanceType<typeof Errors.ErrorArgumentsToMutuallyExclusiveParameters>
  | InstanceType<typeof Errors.ErrorMissingArgumentForMutuallyExclusiveParameters>
  | ParseErrorBasic

export type ParseError =
  | ParseErrorBasic
  | ParseErrorExclusiveGroup
  | InstanceType<typeof Errors.ErrorDuplicateEnvArg>
  | Line.LocalParseErrors

export type ParseResultBasicSupplied = {
  _tag: 'supplied'
  parameter: ParameterBasic
  value: ArgumentValue
}

export type ParseResultBasicError = {
  _tag: 'error'
  parameter: ParameterBasic
  errors: ParseErrorBasic[]
}
export type ParseResultBasicOmitted = {
  _tag: 'omitted'
  parameter: ParameterBasic
}

export type ParseResultBasic =
  | ParseResultBasicSupplied
  | ParseResultBasicError
  | ParseResultBasicOmitted

export type ParseResultExclusiveGroupSupplied = {
  _tag: 'supplied'
  spec: ParameterExclusiveGroup
  parameter: ParameterExclusive
  value: ArgumentValueMutuallyExclusive
}

export type ParseResultExclusiveGroupError = {
  _tag: 'error'
  parameter: ParameterExclusiveGroup
  errors: ParseErrorExclusiveGroup[]
}

export type ParseResultExclusiveGroup =
  | ParseResultExclusiveGroupSupplied
  | {
      _tag: 'omitted'
      parameter: ParameterExclusiveGroup
    }
  | ParseResultExclusiveGroupError

export type ParseResult = {
  globalErrors: ParseErrorGlobal[]
  basicParameters: Record<string, ParseResultBasic>
  mutuallyExclusiveParameters: Record<string, ParseResultExclusiveGroup>
}
