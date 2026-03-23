import { describe, expect, test } from 'vitest'
import * as WareNamespace from './_.js'
import * as Ware from './__.js'
import { initialInput2, pipeline, pipelineWithOptions, run } from './_.test-helpers.js'
import {
  ContextualAggregateError,
  ContextualError,
  partitionAndAggregateErrors,
} from './_errors.js'
import {
  ErrorAnywareInterceptorEntrypoint,
  InterceptorEntryHookIssue,
  getEntryStep,
} from './run/getEntrypoint.js'
import { createResultEnvelope } from './run/resultEnvelope.js'

describe('ware', () => {
  test('re-exports the public runtime surface', () => {
    expect(WareNamespace.Ware.PipelineDefinition.create).toBe(Ware.PipelineDefinition.create)
    expect(WareNamespace.Ware.createRunner).toBe(Ware.createRunner)
    expect(WareNamespace.Ware.StepDefinition).toBe(Ware.StepDefinition)
    expect(Ware.createRetryingInterceptor(async () => `ok`)).toMatchObject({
      retrying: true,
      run: expect.any(Function),
    })
  })

  test('resolves config defaults and creates trigger and result helpers', async () => {
    expect(Ware.PipelineDefinition.resolveOptions()).toEqual({
      entrypointSelectionMode: `required`,
      passthroughErrorInstanceOf: [],
      passthroughErrorWith: null,
    })

    const passthroughErrorWith = (signal: { hookName: string }) => signal.hookName === `step`

    expect(
      Ware.PipelineDefinition.resolveOptions({
        entrypointSelectionMode: `off`,
        passthroughErrorInstanceOf: [Error],
        passthroughErrorWith,
      }),
    ).toEqual({
      entrypointSelectionMode: `off`,
      passthroughErrorInstanceOf: [Error],
      passthroughErrorWith,
    })

    const stepDefinition = Ware.StepDefinition.createWithInput<{ value: string }>()({
      name: `demo`,
      run: (input) => ({ value: `${input.value}:done` }),
    })
    expect(stepDefinition.name).toBe(`demo`)

    const trigger = Ware.StepTrigger.create(
      initialInput2,
      async (parameters?: { input?: { value: string } }) => {
        return parameters?.input?.value ?? `default`
      },
    )
    expect(trigger.input).toEqual(initialInput2)
    expect(await trigger({ input: { value: `override` } })).toBe(`override`)

    expect(Ware.successfulResult(`done`)).toEqual({ value: `done` })

    const resultEnvelope = createResultEnvelope(`finished`)
    expect(resultEnvelope.result).toBe(`finished`)
    expect(Object.getOwnPropertySymbols(resultEnvelope)).toHaveLength(1)

    const [values, aggregatedError] = partitionAndAggregateErrors([1, new Error(`oops`), 2])
    expect(values).toEqual([1, 2])
    expect(aggregatedError).toBeInstanceOf(ContextualAggregateError)
    expect(aggregatedError?.message).toBe(`One or more extensions are invalid.`)
    expect(aggregatedError?.errors).toHaveLength(1)
  })

  test('analyzes interceptor entrypoints', () => {
    const cases = [
      {
        issue: InterceptorEntryHookIssue.multipleParameters,
        interceptor: (_a: unknown, _b: unknown) => undefined,
      },
      {
        issue: InterceptorEntryHookIssue.noParameters,
        interceptor: () => undefined,
      },
      {
        issue: InterceptorEntryHookIssue.notDestructured,
        interceptor: (_hooks: unknown) => undefined,
      },
      {
        issue: InterceptorEntryHookIssue.multipleDestructuredHookNames,
        interceptor: ({ a, b }: Record<string, unknown>) => a ?? b,
      },
      {
        issue: InterceptorEntryHookIssue.invalidDestructuredHookNames,
        interceptor: ({ z }: Record<string, unknown>) => z,
      },
    ] as const

    for (const { interceptor, issue } of cases) {
      const result = getEntryStep(pipeline, interceptor)
      expect(result).toBeInstanceOf(ErrorAnywareInterceptorEntrypoint)
      expect((result as ErrorAnywareInterceptorEntrypoint).context).toEqual({ issue })
    }

    const destructuredWithoutEntryHook = new ErrorAnywareInterceptorEntrypoint({
      issue: InterceptorEntryHookIssue.destructuredWithoutEntryHook,
    })
    expect(destructuredWithoutEntryHook.context).toEqual({
      issue: InterceptorEntryHookIssue.destructuredWithoutEntryHook,
    })

    const step = getEntryStep(pipeline, ({ b }: Record<string, unknown>) => b)
    expect(step).toMatchObject({ name: `b` })
  })

  test('builds and runs overloaded pipelines through pipeline and extension builders', async () => {
    const extension = Ware.Extension.Builder.create<
      ReturnType<typeof createBaseBuilder>['type']
    >().overload(({ create }) => {
      const overload = create({
        discriminant: { name: `kind`, value: `special` },
      })
      overload.configurator((builder) => builder.default({ featureFlag: true }))
      overload.stepWithExtendedInput<{ featureFlag: boolean }>()(`decorate`, {
        run: (input: { kind: string; value: string; featureFlag: boolean }) => ({
          kind: input.kind,
          value: `${input.value}:special-decorate`,
        }),
      })
      return overload
    })

    const executablePipeline = createBaseBuilder()
      .use(extension)
      .overload(({ create }) =>
        create({
          discriminant: { name: `kind`, value: `special` },
        }).step(`finalize`, {
          run: (input: { value: string }) => ({
            value: `${input.value}:special-final`,
          }),
        }),
      )
      .done()

    expect(
      await Ware.PipelineDefinition.run(executablePipeline, {
        initialInput: { kind: `plain`, value: `seed` },
      }),
    ).toEqual({ value: { value: `seed:decorate:final` } })

    expect(
      await Ware.PipelineDefinition.run(executablePipeline, {
        initialInput: { kind: `special`, value: `seed` },
      }),
    ).toEqual({ value: { value: `seed:special-decorate:special-final` } })
  })

  test('runs pipelines directly and via createRunner', async () => {
    expect(await run()).toEqual({ value: { value: `initial+a+b` } })

    const runner = Ware.createRunner(pipeline)
    expect(await runner({ initialInput: initialInput2 })).toEqual({
      value: { value: `initial+a+b` },
    })

    const intercepted = await run(async ({ a }) => {
      const { b } = await a({
        input: { value: `override` },
        using: {
          appendExtra: () => `:extra-a`,
        },
      })
      return await b({
        using: {
          appendExtra: () => `:extra-b`,
        },
      })
    })

    expect(intercepted).toEqual({ value: { value: `override+a:extra-a+b:extra-b` } })

    expect(await run(async ({ a }) => `short-circuit`)).toEqual({ value: `short-circuit` })

    const secondStepInterceptor = await run(async ({ b }) => {
      return await b({
        using: {
          appendExtra: () => `:from-b`,
        },
      })
    })

    expect(secondStepInterceptor).toEqual({ value: { value: `initial+a+b:from-b` } })
  })

  test('supports optional and off entrypoint selection while rejecting invalid interceptors in required mode', async () => {
    const required = await pipelineWithOptions({ entrypointSelectionMode: `required` }).run(
      async (hooks) => hooks,
    )
    expect(required).toBeInstanceOf(ContextualAggregateError)

    const optional = await pipelineWithOptions({ entrypointSelectionMode: `optional` }).run(
      async (hooks) => hooks,
    )
    expect(optional).toEqual({ value: { value: `initial+a+b` } })

    const off = await pipelineWithOptions({ entrypointSelectionMode: `off` }).run(
      async (hooks) => hooks,
    )
    expect(off).toEqual({ value: { value: `initial+a+b` } })
  })

  test('wraps extension and implementation failures with contextual errors', async () => {
    const extensionFailure = await run(async ({ a }) => {
      throw new Error(`interceptor failed`)
    })
    expect(extensionFailure).toBeInstanceOf(ContextualError)
    expect((extensionFailure as ContextualError).message).toContain(`interceptor "anonymous"`)
    expect((extensionFailure as ContextualError).context).toEqual({
      hookName: `a`,
      source: `extension`,
      interceptorName: `anonymous`,
    })

    const implementationFailurePipeline = Ware.PipelineDefinition.create()
      .input<{ value: string }>()
      .step(`explode`, {
        run: () => {
          throw new Error(`implementation failed`)
        },
      })
      .done()

    const implementationFailure = await Ware.PipelineDefinition.run(implementationFailurePipeline, {
      initialInput: { value: `initial` },
    })

    expect(implementationFailure).toBeInstanceOf(ContextualError)
    expect((implementationFailure as ContextualError).message).toBe(
      `There was an error in the core implementation of hook "explode".`,
    )
    expect((implementationFailure as ContextualError).context).toEqual({
      hookName: `explode`,
      source: `implementation`,
    })
  })

  test('supports passthrough errors and retrying interceptors', async () => {
    class AbortLikeError extends Error {}

    const abortLikeError = new AbortLikeError(`abort`)
    const passthroughByClass = Ware.PipelineDefinition.create({
      passthroughErrorInstanceOf: [AbortLikeError],
    })
      .input<{ value: string }>()
      .step(`abort`, {
        run: () => {
          throw abortLikeError
        },
      })
      .done()

    expect(
      await Ware.PipelineDefinition.run(passthroughByClass, {
        initialInput: { value: `initial` },
      }),
    ).toBe(abortLikeError)

    const passthroughError = new Error(`passthrough`)
    const passthroughByPredicate = Ware.PipelineDefinition.create({
      passthroughErrorWith: (signal) => signal.error === passthroughError,
    })
      .input<{ value: string }>()
      .step(`predicate`, {
        run: () => {
          throw passthroughError
        },
      })
      .done()

    expect(
      await Ware.PipelineDefinition.run(passthroughByPredicate, {
        initialInput: { value: `initial` },
      }),
    ).toBe(passthroughError)

    let attempts = 0
    const retryablePipeline = Ware.PipelineDefinition.create()
      .input<{ value: string }>()
      .step(`retry`, {
        run: (input) => {
          attempts += 1
          if (attempts === 1) throw new Error(`retry once`)
          return { value: `${input.value}:retried` }
        },
      })
      .done()

    const retryingResult = await Ware.PipelineDefinition.run(retryablePipeline, {
      initialInput: { value: `initial` },
      retryingInterceptor: async ({ retry }) => {
        const firstAttempt = await retry()
        if (firstAttempt instanceof Error) {
          return await retry({
            input: { value: `second` },
          })
        }
        return firstAttempt
      },
    })

    expect(retryingResult).toEqual({ value: { value: `second:retried` } })
  })
})

const createBaseBuilder = () =>
  Ware.PipelineDefinition.create()
    .input<{ kind: `plain` | `special`; value: string }>()
    .step(`decorate`, {
      run: (input) => ({
        kind: input.kind,
        value: `${input.value}:decorate`,
      }),
    })
    .stepWithRunnerType<
      (
        input: { kind: `plain` | `special`; value: string },
        slots: undefined,
        previous: {
          decorate: {
            input: { kind: `plain` | `special`; value: string }
            output: { kind: `plain` | `special`; value: string }
          }
        },
      ) => { value: string }
    >()(`finalize`, {
    run: (input) => ({
      value: `${input.value}:final`,
    }),
  })
