import { Lang, Obj } from '@kitz/core'
import { Effect } from 'effect'
import type { RawArgInputs } from '../builders/command/types.js'
import { getLowerCaseEnvironment, isTestingOak } from '../env.js'
import { createEvent } from '../eventPatterns.js'
import { Help } from '../Help/_.js'
import { lowerCaseObjectKeys } from '../helpers.js'
import { Prompter } from '../lib/Prompter/_.js'
import { OpeningArgs } from '../OpeningArgs/_.js'
import type { ParameterBasic, ParameterBasicInput } from '../Parameter/basic.js'
import type { ParameterExclusiveInput } from '../Parameter/exclusive.js'
import { match } from '../Pattern/Pattern.js'
import type { Settings } from '../Settings/_.js'
import { createParameters } from './helpers/createParameters.js'
import { prompt } from './prompt.js'
import type { ArgumentValue } from './types.js'

export interface ParseProgressPostPromptAnnotation {
  globalErrors: OpeningArgs.SchemaIssue['globalErrors']
  mutuallyExclusiveParameters: OpeningArgs.SchemaIssue['mutuallyExclusiveParameters']
  basicParameters: Record<
    string,
    {
      openingParseResult: OpeningArgs.SchemaIssue['basicParameters'][string]
      spec: OpeningArgs.SchemaIssue['basicParameters'][string]['parameter']
      prompt: {
        enabled: boolean
      }
    }
  >
}

export interface ParseProgressPostPrompt {
  globalErrors: OpeningArgs.SchemaIssue['globalErrors']
  mutuallyExclusiveParameters: OpeningArgs.SchemaIssue['mutuallyExclusiveParameters']
  basicParameters: Record<
    string,
    {
      spec: OpeningArgs.SchemaIssue['basicParameters'][string]['parameter']
      openingParseResult: OpeningArgs.SchemaIssue['basicParameters'][string]
      prompt: {
        enabled: boolean
        arg: ArgumentValue
      }
    }
  >
}

export interface ParseProgressDone {
  globalErrors: OpeningArgs.SchemaIssue['globalErrors']
  mutuallyExclusiveParameters: OpeningArgs.SchemaIssue['mutuallyExclusiveParameters']
  basicParameters: Record<
    string,
    {
      spec: OpeningArgs.SchemaIssue['basicParameters'][string]['parameter']
      openingParseResult: OpeningArgs.SchemaIssue['basicParameters'][string]
      prompt: {
        enabled: boolean
        arg: ArgumentValue
      }
      arg: ArgumentValue
    }
  >
}

export const parse = (
  settings: Settings.Output,
  parameterInputs: Record<string, ParameterBasicInput | ParameterExclusiveInput>,
  argInputs: RawArgInputs,
) => {
  const testDebuggingNoExit = isTestingOak()
  const argInputsPrompter =
    argInputs?.tty ?? (process.stdout.isTTY ? Prompter.createProcessPrompter() : null)
  const argInputsLine = argInputs?.line ?? process.argv.slice(2)
  const argInputsEnvironment = argInputs?.environment
    ? lowerCaseObjectKeys(argInputs.environment)
    : getLowerCaseEnvironment()

  // todo handle concept of specs themselves having errors
  const parametersResult = {
    parameters: createParameters(parameterInputs, settings),
  }
  // dump(specsResult)

  const openingArgsResult = OpeningArgs.parse({
    parameters: parametersResult.parameters,
    line: argInputsLine,
    environment: argInputsEnvironment,
  })

  /**
   * Build up a list of parameter prompts. A parameter prompt is added when there is a matching event pattern.
   */

  const parseProgressPostPromptAnnotation = {
    ...openingArgsResult,
    basicParameters: Obj.mapEntries(
      openingArgsResult.basicParameters,
      (parameterName, openingParseResult) => {
        const data = {
          openingParseResult,
          spec: openingParseResult.parameter,
          prompt: {
            enabled: false,
          },
        }
        return [parameterName, data] as const
      },
    ),
  }

  if (argInputsPrompter) {
    const basicSpecs = parametersResult.parameters.filter(
      (_): _ is ParameterBasic => _._tag === `Basic`,
    )
    for (const spec of basicSpecs) {
      const promptEnabled =
        (spec.prompt.when !== null && spec.prompt.enabled !== false) ||
        (spec.prompt.enabled ?? settings.prompt.enabled)
      if (!promptEnabled) continue

      const parseResult = openingArgsResult.basicParameters[spec.name.canonical]
      if (!parseResult) {
        return Lang.panic(`something went wrong, could not get arg parse result`)
      }

      const event = createEvent(parseResult)
      // We cannot prompt for this parameter
      if (event === null) continue

      const eventPatterns_ = spec.prompt.when ?? settings.prompt.when
      const eventPatterns = Array.isArray(eventPatterns_) ? eventPatterns_ : [eventPatterns_]
      for (const pattern of eventPatterns) {
        if (match(event, pattern)) {
          parseProgressPostPromptAnnotation.basicParameters[spec.name.canonical]!.prompt.enabled =
            true
          continue
        }
      }
    }
  }

  const askedForHelp =
    `help` in openingArgsResult.basicParameters &&
    openingArgsResult.basicParameters[`help`]._tag === `supplied` &&
    openingArgsResult.basicParameters[`help`].value === true

  if (askedForHelp) {
    settings.onOutput(Help.render(parametersResult.parameters, settings) + `\n`)
    if (!testDebuggingNoExit) process.exit(0)
    return undefined as never // When testing, with process.exit mock, we WILL reach this case
  }

  /**
   * If there are global errors then we must abort as it compromises the program intent.
   * A global error could be something like the user having supplied an unknown parameter.
   *
   * Likewise if there are argument errors that are NOT going to be prompted for, we must abort too.
   */
  const argumentErrors = [
    ...Obj.entries(parseProgressPostPromptAnnotation.basicParameters)
      .map(([_, v]): null | OpeningArgs.ParseResultBasicError => {
        return !v.prompt.enabled && v.openingParseResult._tag === `error`
          ? v.openingParseResult
          : null
      })
      .filter((_): _ is OpeningArgs.ParseResultBasicError => _ !== null),
    ...Obj.entries(parseProgressPostPromptAnnotation.mutuallyExclusiveParameters)
      .map(([_, v]): null | OpeningArgs.ParseResultExclusiveGroupError => {
        return v._tag === `error` ? v : null
      })
      .filter((_): _ is OpeningArgs.ParseResultExclusiveGroupError => _ !== null),
  ]

  if (parseProgressPostPromptAnnotation.globalErrors.length > 0 || argumentErrors.length > 0) {
    if (settings.helpOnError) {
      const message =
        `Cannot run command, you made some mistakes:\n\n` +
        openingArgsResult.globalErrors.map((_) => _.message).join(`\nX `) +
        argumentErrors.map((_) => _.errors.map((_) => _.message).join(`\nX `)).join(`\nX `) +
        `\n\nHere are the docs for this command:\n`
      settings.onOutput(message + `\n`)
      settings.onOutput(Help.render(parametersResult.parameters, settings) + `\n`)
    }
    if (settings.onError === `exit` && !testDebuggingNoExit) {
      process.exit(1)
      // @ts-expect-error TS7027 - Reachable in tests when process.exit is mocked
      return undefined as never
    }
    const allErrors = [
      ...openingArgsResult.globalErrors,
      ...argumentErrors.map((_) =>
        _.errors.length > 1 ? new AggregateError(_.errors) : _.errors[0],
      ),
    ]
    if (allErrors.length > 1) {
      throw new AggregateError(allErrors)
    } else {
      throw allErrors[0]!
    }
  }

  const hasPrompt =
    Obj.values(parseProgressPostPromptAnnotation.basicParameters).some((_) => _.prompt.enabled) &&
    argInputsPrompter

  /**
   * Progress to the next parse stage wherein we will execute prompts.
   */

  const tailProcess = (
    parseProgressPostPrompts: ParseProgressPostPrompt | ParseProgressPostPromptAnnotation,
  ) => {
    const args = {
      ...Object.fromEntries(
        Obj.entries(parseProgressPostPrompts.basicParameters)
          .map(([k, v]): [string, ArgumentValue] | null => {
            if (v.prompt.enabled) {
              return `arg` in v.prompt ? [k, v.prompt.arg] : null
            } else if (v.openingParseResult._tag === `supplied`) {
              return [k, v.openingParseResult.value]
            } else if (v.openingParseResult._tag === `omitted`) {
              // Handle omitted parameters - use the omittedValue from optionality metadata
              const optionality = v.spec.type.metadata.optionality
              if (
                optionality._tag === `optional` &&
                `omittedValue` in optionality &&
                optionality.omittedValue !== undefined
              ) {
                // Only include the key if omittedValue is explicitly set to a non-undefined value (e.g., null for NullOr)
                return [k, optionality.omittedValue]
              }
              // Otherwise, don't include the key (undefined by absence)
              return null
            } else {
              return null
            }
          })
          .filter((kv): kv is [string, ArgumentValue] => kv !== null),
      ),
      ...Object.fromEntries(
        Obj.values(parseProgressPostPrompts.mutuallyExclusiveParameters)
          .filter((_): _ is OpeningArgs.ParseResultExclusiveGroupSupplied => _._tag === `supplied`)
          .map((v) => [v.spec.label, v.value]),
      ),
    }

    /**
     * Handle the distinct case of no arguments. Sometimes the CLI author wants this to mean "show help".
     */
    if (settings.helpOnNoArguments && Obj.values(args).length === 0) {
      settings.onOutput(Help.render(parametersResult.parameters, settings) + `\n`)
      if (!testDebuggingNoExit) process.exit(0)
      throw new Error(`missing args`) // When testing, with process.exit mock, we will reach this case
    }

    return args
  }

  return hasPrompt
    ? Effect.runPromise(
        prompt(parseProgressPostPromptAnnotation, argInputsPrompter).pipe(Effect.map(tailProcess)),
      )
    : tailProcess(parseProgressPostPromptAnnotation)
}
