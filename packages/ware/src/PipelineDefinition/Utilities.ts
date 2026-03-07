import { Tup } from '@kitz/core'
import type { Result } from '../Result.js'
import type { PipelineDefinition } from './_.js'

export namespace Utilities {
  // oxfmt-ignore
  export type InferOutput<$PipelineDef extends PipelineDefinition> =
		Awaited<
			$PipelineDef['steps'] extends Tup.NonEmpty
        ? Tup.GetLastValue<$PipelineDef['steps']>['output']
        : $PipelineDef['input']
    >

  // oxfmt-ignore
  export type InferResult<$PipelineDef extends PipelineDefinition> =
		Result<InferOutput<$PipelineDef>>
}
