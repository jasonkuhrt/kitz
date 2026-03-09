import { Lang, Prom } from '@kitz/core'
import { ContextualError, partitionAndAggregateErrors } from '../_errors.js'
import {
  createRetryingInterceptor,
  type InterceptorGeneric,
  type InterceptorInput,
  type NonRetryingInterceptorInput,
} from '../Interceptor/Interceptor.js'
import type { Pipeline } from '../Pipeline/Pipeline.js'
import type { PipelineDefinition } from '../PipelineDefinition/_.js'
import { successfulResult, type Result } from '../Result.js'
import type { ResultSuccess } from '../Result.js'
import type { StepDefinition } from '../StepDefinition.js'
import type { StepResultErrorExtension } from '../StepResult.js'
import type { StepTriggerEnvelope } from '../StepTriggerEnvelope.js'
import { getEntryStep } from './getEntrypoint.js'
import { runPipeline } from './runPipeline.js'

export interface Params<$Pipeline extends Pipeline = Pipeline> {
  initialInput: $Pipeline['input']
  interceptors?: readonly NonRetryingInterceptorInput[]
  retryingInterceptor?: NonRetryingInterceptorInput
}

export const createRunner =
  <$Pipeline extends Pipeline>(pipeline: $Pipeline) =>
  async (params?: Params<$Pipeline>): Promise<Result<$Pipeline['output']>> => {
    const { initialInput, interceptors = [], retryingInterceptor } = params ?? {}

    const interceptors_ = retryingInterceptor
      ? [...interceptors, createRetryingInterceptor(retryingInterceptor)]
      : interceptors
    const initialHookStackAndErrors = interceptors_.map((extension) =>
      toInternalInterceptor(pipeline, extension),
    )
    const [initialHookStack, error] = partitionAndAggregateErrors(initialHookStackAndErrors)
    if (error) return error

    const asyncErrorDeferred = Prom.createDeferred<StepResultErrorExtension>({ strict: false })
    const result = await runPipeline({
      pipeline,
      stepsToProcess: pipeline.steps,
      originalInputOrResult: initialInput,
      interceptorsStack: initialHookStack,
      asyncErrorDeferred,
      previousStepsCompleted: {},
    })
    if (result instanceof Error) return result

    return successfulResult(result.result)
  }

const toInternalInterceptor = (
  pipeline: PipelineDefinition.Pipeline,
  interceptor: InterceptorInput,
): InterceptorGeneric | Error => {
  const interceptorTrigger = typeof interceptor === `function` ? interceptor : interceptor.run
  const retrying = typeof interceptor === `function` ? false : interceptor.retrying
  const currentChunkNonRetrying = Prom.createDeferred<StepTriggerEnvelope | ResultSuccess>()
  const currentChunkRetrying = Prom.createDeferred<StepTriggerEnvelope | Error | ResultSuccess>()
  const currentChunk = retrying ? currentChunkRetrying : currentChunkNonRetrying
  const body = Prom.createDeferred()

  const applyBody = (input: object) => {
    void Promise.resolve(Prom.maybeAsyncEnvelope(() => interceptorTrigger(input))).then(
      (envelope) => {
        if (envelope.fail) {
          body.reject(envelope.value)
        } else {
          body.resolve(envelope.value)
        }
        return undefined
      },
    )
  }

  const interceptorName = interceptorTrigger.name || `anonymous`
  const defaultEntrypoint = pipeline.steps[0]?.name ?? ''
  const createInternalInterceptor = (entrypoint: string): InterceptorGeneric =>
    retrying
      ? {
          retrying: true,
          name: interceptorName,
          entrypoint,
          body,
          currentChunk: currentChunkRetrying,
        }
      : {
          retrying: false,
          name: interceptorName,
          entrypoint,
          body,
          currentChunk: currentChunkNonRetrying,
        }

  switch (pipeline.config.entrypointSelectionMode) {
    case `off`: {
      void currentChunk.promise.then(applyBody)
      return createInternalInterceptor(defaultEntrypoint)
    }
    case `optional`:
    case `required`: {
      const entryStep = getEntryStep(pipeline, interceptorTrigger)
      if (entryStep instanceof Error) {
        if (pipeline.config.entrypointSelectionMode === `required`) {
          return entryStep
        } else {
          void currentChunk.promise.then(applyBody)
          return createInternalInterceptor(defaultEntrypoint)
        }
      }

      const stepsBeforeEntrypoint: StepDefinition.Name[] = []
      for (const step of pipeline.steps) {
        if (step === entryStep) break
        stepsBeforeEntrypoint.push(step.name)
      }

      const passthroughs = stepsBeforeEntrypoint.map((hookName) => createPassthrough(hookName))
      let currentChunkPromiseChain = currentChunk.promise
      for (const passthrough of passthroughs) {
        currentChunkPromiseChain = currentChunkPromiseChain.then(passthrough)
      }
      void currentChunkPromiseChain.then(applyBody)

      return createInternalInterceptor(entryStep.name)
    }
    default:
      throw Lang.neverCase(pipeline.config.entrypointSelectionMode)
  }
}

const createPassthrough =
  (hookName: string) => async (hookEnvelope: StepTriggerEnvelope | ResultSuccess | Error) => {
    if (hookEnvelope instanceof Error || isResultSuccess(hookEnvelope)) {
      return hookEnvelope
    }
    const hook = hookEnvelope[hookName]
    if (!hook) {
      throw new ContextualError(`Hook not found in hook envelope`, { hookName })
    }
    return await hook({ input: hook.input })
  }

const isResultSuccess = (value: unknown): value is ResultSuccess =>
  typeof value === 'object' && value !== null && 'value' in value
