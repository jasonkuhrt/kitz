import { Obj } from '@kitz/core'
import { Tex } from '@kitz/tex'
import * as ansis from 'ansis'
import { Effect } from 'effect'
import type { Prompter } from '../lib/Prompter/_.js'
import { Text } from '../lib/Text/_.js'
import * as SchemaRuntime from '../schema/schema-runtime.js'
import { Term } from '../term.js'
import type { ParseProgressPostPrompt, ParseProgressPostPromptAnnotation } from './parse.js'
import type { ArgumentValue } from './types.js'

/**
 * Get args from the user interactively via the console for the given parameters.
 */
export const prompt = (
  parseProgress: ParseProgressPostPromptAnnotation,
  prompter: null | Prompter.Prompter,
): Effect.Effect<ParseProgressPostPrompt> =>
  Effect.gen(function* () {
    if (prompter === null) {
      return {
        ...parseProgress,
        basicParameters: Obj.mapEntries(parseProgress.basicParameters, (parameterName, value) => [
          parameterName,
          {
            ...value,
            prompt: {
              enabled: value.prompt.enabled,
              arg: undefined,
            },
          },
        ]),
      }
    }

    const args: Record<string, ArgumentValue> = {}
    const parameters = Obj.entries(parseProgress.basicParameters)
      .filter((_: any) => _[1].prompt.enabled)
      .map((_: any) => _[1].spec)
    const indexTotal = parameters.length
    let indexCurrent = 1
    const gutterWidth = String(indexTotal).length * 2 + 3

    for (const parameter of parameters) {
      // Explicitly set terminal width for deterministic rendering (kit 0.87.0+)
      const PROMPT_TERMINAL_WIDTH = 120
      const positionLabel = Term.colors.dim(`${indexCurrent}/${indexTotal}`)
      const optionalLabel =
        parameter.type.metadata.optionality._tag === `required`
          ? ``
          : ansis.dim(` optional (press esc to skip)`)
      const question = Tex.Tex({ orientation: `horizontal`, terminalWidth: PROMPT_TERMINAL_WIDTH })
        .block({ padding: { mainEnd: 2 } }, positionLabel)
        .block((__) =>
          __.block(Term.colors.positive(parameter.name.canonical) + optionalLabel).block(
            (parameter.type.metadata.description &&
              Term.colors.dim(parameter.type.metadata.description)) ??
              null,
          ),
        )
        .render()
      while (true) {
        const asking = prompter.ask({
          question,
          prompt: `❯ `,
          marginLeft: gutterWidth,
          parameter,
        })
        const arg = yield* asking
        const validationResult = SchemaRuntime.validate(parameter.type, arg)
        if (validationResult._tag === `Success`) {
          if (isArgumentValue(validationResult.success)) {
            args[parameter.name.canonical] = validationResult.success
            prompter.say(``) // newline
            indexCurrent++
            break
          }
          prompter.say(
            Text.pad(
              `left`,
              gutterWidth,
              ` `,
              Term.colors.alert(
                `Invalid value: expected string, number, boolean, null, or undefined`,
              ),
            ),
          )
        } else {
          prompter.say(
            Text.pad(
              `left`,
              gutterWidth,
              ` `,
              Term.colors.alert(`Invalid value: ${validationResult.failure.errors.join(`, `)}`),
            ),
          )
        }
      }
    }

    return {
      ...parseProgress,
      basicParameters: Obj.mapEntries(parseProgress.basicParameters, (parameterName, value) => [
        parameterName,
        {
          ...value,
          prompt: {
            enabled: value.prompt.enabled,
            arg: args[parameterName],
          },
        },
      ]),
    }
  })

const isArgumentValue = (value: unknown): value is ArgumentValue =>
  value === undefined ||
  value === null ||
  typeof value === `string` ||
  typeof value === `number` ||
  typeof value === `boolean`
