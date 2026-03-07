import { Lang, Prom } from '@kitz/core'
import { Log } from '@kitz/log'
import { ContextualError } from '../_errors.js'
import type { InterceptorGeneric } from '../Interceptor/Interceptor.js'
import type { Pipeline } from '../Pipeline/Pipeline.js'
import { successfulResult } from '../Result.js'
import type { Step } from '../Step.js'
import type { StepResult, StepResultErrorAsync } from '../StepResult.js'
import { createResultEnvelope } from './resultEnvelope.js'
import type { ResultEnvelop } from './resultEnvelope.js'
import { runStep } from './runStep.js'

// 'anyware:pipeline'
const debug = Log.create({})

export const defaultFunctionName = `anonymous`

export const runPipeline = async ({
  pipeline,
  stepsToProcess,
  originalInputOrResult,
  interceptorsStack,
  asyncErrorDeferred,
  previousStepsCompleted,
}: {
  pipeline: Pipeline
  stepsToProcess: readonly Step[]
  originalInputOrResult: unknown
  interceptorsStack: readonly InterceptorGeneric[]
  asyncErrorDeferred: StepResultErrorAsync
  previousStepsCompleted: object
}): Promise<ResultEnvelop | Error> => {
  const [stepToProcess, ...stepsRestToProcess] = stepsToProcess

  if (!stepToProcess) {
    debug.trace(`pipeline: ending`)
    const result = await runPipelineEnd({ interceptorsStack, result: originalInputOrResult })
    debug.trace(`pipeline: returning`)
    return createResultEnvelope(result)
  }

  debug.trace(`hook ${stepToProcess.name}: start`)

  const done = Prom.createDeferred<StepResult>({ strict: false })

  // We do not await the step runner here.
  // Instead we work with a deferred passed to it.
  void runStep({
    pipeline,
    name: stepToProcess.name,
    done: done.resolve,
    inputOriginalOrFromExtension: originalInputOrResult as object,
    previousStepsCompleted,
    interceptorsStack,
    asyncErrorDeferred,
    customSlots: {},
    nextInterceptorsStack: [],
  })

  const signal = await racePromises(done.promise, asyncErrorDeferred.promise)

  switch (signal.type) {
    case `completed`: {
      const { result, effectiveInput, nextExtensionsStack } = signal
      const nextPreviousStepsCompleted = {
        ...previousStepsCompleted,
        [stepToProcess.name]: {
          input: effectiveInput,
        },
      }
      return await runPipeline({
        pipeline,
        stepsToProcess: stepsRestToProcess,
        originalInputOrResult: result,
        interceptorsStack: nextExtensionsStack,
        previousStepsCompleted: nextPreviousStepsCompleted,
        asyncErrorDeferred,
      })
    }
    case `shortCircuited`: {
      debug.trace(`signal: shortCircuited`)
      const { result } = signal
      return createResultEnvelope(result)
    }
    case `error`: {
      debug.trace(`signal: error`)

      if (pipeline.config.passthroughErrorWith?.(signal)) {
        return signal.error
      }

      if (pipeline.config.passthroughErrorInstanceOf.some((_) => signal.error instanceof _)) {
        return signal.error
      }

      const wasAsync = asyncErrorDeferred.isResolved
      // todo type test for this possible return value
      switch (signal.source) {
        case `extension`: {
          // todo test these 2 branches explicitly
          const nameTip =
            signal.interceptorName === defaultFunctionName
              ? ` (use named functions to improve this error message)`
              : ``
          const message = wasAsync
            ? `There was an error in the interceptor "${signal.interceptorName}"${nameTip}.`
            : `There was an error in the interceptor "${signal.interceptorName}"${nameTip} while running hook "${signal.hookName}".`

          return new ContextualError(
            message,
            {
              hookName: signal.hookName,
              source: signal.source,
              interceptorName: signal.interceptorName,
            },
            signal.error,
          )
        }
        case `implementation`: {
          const message = `There was an error in the core implementation of hook "${signal.hookName}".`
          return new ContextualError(
            message,
            { hookName: signal.hookName, source: signal.source },
            signal.error,
          )
        }
        case `user`: {
          return signal.error
        }
        default:
          throw Lang.neverCase(signal)
      }
    }
    default:
      throw Lang.neverCase(signal)
  }
}

const runPipelineEnd = async ({
  interceptorsStack,
  result,
}: {
  result: unknown
  interceptorsStack: readonly InterceptorGeneric[]
}): Promise<unknown> => {
  const [interceptor, ...interceptorsRest] = interceptorsStack
  if (!interceptor) return result

  debug.trace(`interceptor ${interceptor.name}: end`)
  interceptor.currentChunk.resolve(successfulResult(result))
  const nextResult = await interceptor.body.promise
  return await runPipelineEnd({
    interceptorsStack: interceptorsRest,
    result: nextResult,
  })
}

const racePromises = <$First, $Second>(
  first: Promise<$First>,
  second: Promise<$Second>,
): Promise<$First | $Second> => {
  const winner = Prom.createDeferred<$First | $Second>({ strict: false })
  void first.then(winner.resolve, winner.reject)
  void second.then(winner.resolve, winner.reject)
  return winner.promise
}
