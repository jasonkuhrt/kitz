import { Cli } from '@kitz/cli'
import type { BuilderCommandState } from '../builders/command/state.js'
import { S } from '../deps/effect.js'
import type { Pam } from '../lib/Pam/_.js'
import type { OakSchema } from '../schema/oak-schema.js'
import type { Settings } from '../Settings/_.js'
import { processEnvironment } from './helpers/environment.js'
import type { Environment, Prompt } from './helpers/types.js'

export interface ParameterBasicInput<
  $State extends BuilderCommandState.Base = BuilderCommandState.BaseEmpty,
> {
  _tag: 'Basic'
  nameExpression: string
  type: OakSchema
  prompt: Prompt<BuilderCommandState.Type<$State>>
}

export interface ParameterBasic extends Omit<Pam.Parameter, '_tag'> {
  _tag: 'Basic'
  environment: Environment
  prompt: Prompt
}

export const parameterBasicCreate = (
  input: ParameterBasicInput,
  settings: Settings.Output,
): ParameterBasic => {
  const name = S.decodeSync(Cli.Param.String)(input.nameExpression)
  const environment = processEnvironment(settings, name)
  return {
    _tag: `Basic`,
    environment,
    name,
    prompt: {
      enabled: input.prompt.enabled,
      when: input.prompt.when,
    },
    type: input.type,
  }
}

export type ParameterBasicData = Omit<ParameterBasic, '_tag'> & {
  _tag: 'BasicData'
  optionality: OakSchema['metadata']['optionality']['_tag']
}
