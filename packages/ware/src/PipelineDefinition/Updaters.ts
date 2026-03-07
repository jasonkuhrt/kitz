import type { Obj } from '@kitz/core'
import type { Data as OverloadData } from '../Overload/_.js'
import type { StepDefinition } from '../StepDefinition.js'
import type { PipelineDefinition } from './_.js'

export namespace Updaters {
  export type SetInput<
    $PipelineDef extends PipelineDefinition,
    $Input extends object,
  > = Obj.SetKey<$PipelineDef, 'input', $Input>

  export type AddStep<
    $PipelineDef extends PipelineDefinition,
    $Step extends StepDefinition,
  > = Obj.UpdateKeyWithAppendOne<$PipelineDef, 'steps', $Step>

  export type AddOverload<
    $PipelineDef extends PipelineDefinition,
    $Overload extends OverloadData,
  > = Obj.UpdateKeyWithAppendOne<$PipelineDef, 'overloads', $Overload>

  export type AddOverloadMany<
    $PipelineDef extends PipelineDefinition,
    $Overloads extends readonly OverloadData[],
  > = Obj.UpdateKeyWithAppendMany<$PipelineDef, 'overloads', $Overloads>
}
