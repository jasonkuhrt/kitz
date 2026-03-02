import { Err, Obj, Str } from '@kitz/core'
import { Group } from '@kitz/group'
import { Tex } from '@kitz/tex'
import ansis from 'ansis'
import { Text } from '../lib/Text/_.js'
import type { Parameter } from '../Parameter/types.js'
import * as SchemaRuntime from '../schema/schema-runtime.js'
import type { Settings } from '../Settings/_.js'
import { Term } from '../term.js'

// TODO use
interface RenderSettings {
  /**
   * Should parameter names be displayed with dash prefixes.
   * @defaultValue false
   */
  flagDash?: boolean
  /**
   * Should the help output be colored?
   * @defaultValue true
   */
  color?: boolean
}

export const render = (parameters_: Parameter[], settings: Settings.Output, _settings?: RenderSettings) => {
  const allParameters = parameters_
  const parametersWithDescription = allParameters.filter((_) =>
    _.type.metadata.description !== null && _.type.metadata.description !== undefined
  )
  const parametersByTag = Group.byToMut(parameters_, `_tag`)
  const basicParameters = parametersByTag.Basic ?? []
  const allParametersWithoutHelp = allParameters
    .filter((_) => _.name.canonical !== `help`)
    .sort((_) =>
      _._tag === `Exclusive`
        ? _.group.optionality._tag === `optional`
          ? 1
          : -1
        : _.type.metadata.optionality._tag === `optional`
        ? 1
        : -1
    )

  const parametersBasicWithoutHelp = basicParameters
    .filter((_) => _.name.canonical !== `help`)
    .sort((_) => (_.type.metadata.optionality._tag === `optional` ? 1 : -1))
  const isAcceptsAnyEnvironmentArgs = basicParameters.filter((_) => _.environment?.enabled).length > 0
  const isAcceptsAnyMutuallyExclusiveParameters = (parametersByTag.Exclusive && parametersByTag.Exclusive.length > 0)
    || false
  const isEnvironmentEnabled = Obj.values(settings.parameters.environment).filter((_) => _.enabled).length > 0
  const parameterEnvironmentMaybe = (parameter: Parameter) => {
    if (!isEnvironmentEnabled) return null
    return isEnvironmentEnabled ? parameterEnvironment(parameter, settings) : null
  }

  const columnTitles = {
    name: `Name`,
    typeDescription: parametersWithDescription.length > 0 ? `Type/Description` : `Type`,
    default: `Default`,
    environment: isEnvironmentEnabled ? `Environment (1)` : null,
  }

  const parametersExclusiveGroups = Obj.values(
    Group.byToMut(parametersByTag.Exclusive ?? [], (_) => _.group.label),
  ).map(
    (_) => _![0]!.group,
  )

  const noteItems: (Tex.Block | string | null)[] = []

  if (isAcceptsAnyEnvironmentArgs) {
    noteItems.push(environmentNote(allParametersWithoutHelp, settings))
  }

  if (isAcceptsAnyMutuallyExclusiveParameters) {
    noteItems.push(
      `This is a set of mutually exclusive parameters. Only one can be provided at a time. If more than one is provided, execution will fail with an input error.`,
    )
  }

  const styleHeader = (string: string) => ansis.underline(Term.colors.mute(string))

  const output = Tex.Tex({ terminalWidth: settings.terminalWidth })
    .block(($) => {
      if (!settings.description) return null
      return $
        .block({ padding: [1, 0] }, `ABOUT`)
        .block({ padding: [0, 2] }, settings.description)
    })
    .block({ padding: [1, 0] }, title(`PARAMETERS`))
    .block({ padding: [0, 2] }, ($) =>
      $
        .table(
          { gap: [0, 4] },
          ($) =>
            $
              .header({ padding: [[0, 1]] }, styleHeader(columnTitles.name))
              .header(styleHeader(columnTitles.typeDescription))
              .header(styleHeader(columnTitles.default))
              .header(columnTitles.environment ? styleHeader(columnTitles.environment) : null)
              .rows([
                // BASIC
                ...parametersBasicWithoutHelp.map((parameter) => [
                  parameterName(parameter),
                  Tex.block({ padding: [[0, 1]] }, SchemaRuntime.help(parameter.type, settings)),
                  Tex.block(parameterDefault(parameter)),
                  parameterEnvironmentMaybe(parameter),
                ]),
                // EXCLUSIVE GROUPS
                ...parametersExclusiveGroups.flatMap((parametersExclusive) => {
                  const defaultRendered = parametersExclusive.optionality._tag === `default`
                    ? `${parametersExclusive.optionality.tag}@${
                      String(
                        parametersExclusive.optionality.getValue(),
                      )
                    }`
                    : parametersExclusive.optionality._tag === `optional`
                    ? `undefined`
                    : labels.required

                  return [
                    // OPENING ROW
                    [
                      Tex.block(
                        { border: { edges: { left: Term.colors.dim(`┌`) } } },
                        Term.colors.dim(`─${parametersExclusive.label} ${`(2)`}`),
                      ),
                      '',
                      defaultRendered,
                      ...(isEnvironmentEnabled ? [``] : []),
                    ],
                    // PARAMETER ROWS
                    ...Obj.values(parametersExclusive.parameters).map((parameter) => {
                      return [
                        Tex.block(
                          {
                            border: {
                              edges: {
                                left: (ctx) => {
                                  return ctx.lineIndex === 0
                                    ? Term.colors.accent('◒ ')
                                    : Term.colors.dim('│ ')
                                },
                              },
                            },
                          },
                          parameterName(parameter),
                        ),
                        Tex.block({ padding: [[0, 1]] }, SchemaRuntime.help(parameter.type, settings)),
                        Tex.block(parameterDefault(parameter)),
                        parameterEnvironmentMaybe(parameter),
                      ]
                    }),
                    // CLOSING ROW
                    [
                      Tex.block({ border: { edges: { left: Term.colors.dim(`└`) } } }, Term.colors.dim(`─`)),
                      '',
                      '',
                      ...(isEnvironmentEnabled ? [``] : []),
                    ],
                  ]
                }),
              ]),
        )
        .block({ style: Term.colors.dim }, ($) => {
          if (noteItems.length === 0) {
            return null
          }
          return $.block(
            { padding: { mainStart: 1 }, border: { edges: { bottom: `━` } }, span: { cross: 100n } },
            `NOTES`,
          ).list(
            {
              bullet: {
                graphic: (index) => `(${index + 1})`,
              },
            },
            noteItems,
          )
        }))
    .render()

  return output
}

const environmentNote = (parameters: Parameter[], settings: Settings.Output) => {
  const isHasParametersWithCustomEnvironmentNamespace = parameters
    .filter((_) => _.environment?.enabled)
    .filter(
      (_) =>
        _.environment!.namespaces.filter((_) =>
          settings.parameters.environment.$default.prefix.map(Str.Case.camel).includes(_)
        ).length !== _.environment!.namespaces.length,
    ).length > 0

  let content = ``

  content += (settings.parameters.environment.$default.enabled ? `Parameters` : `Some parameters (marked in docs)`)
    + ` can be passed arguments via environment variables. Command line arguments take precedence. Environment variable names are snake cased versions of the parameter name (or its aliases), case insensitive. `

  if (settings.parameters.environment.$default.prefix.length > 0) {
    if (isHasParametersWithCustomEnvironmentNamespace) {
      content += `By default they must be prefixed with`
      content += ` ${
        Text.joinListEnglish(
          settings.parameters.environment.$default.prefix.map((_) =>
            Term.colors.secondary(Text.toEnvarNameCase(_) + `_`)
          ),
        )
      } (case insensitive), though some parameters deviate (shown in docs). `
    } else {
      content += `They must be prefixed with`
      content += ` ${
        Text.joinListEnglish(
          settings.parameters.environment.$default.prefix.map((_) =>
            Term.colors.secondary(Text.toEnvarNameCase(_) + `_`)
          ),
        )
      } (case insensitive). `
    }
  } else {
    content += isHasParametersWithCustomEnvironmentNamespace
      ? `By default there is no prefix, though some parameters deviate (shown in docs). `
      : `There is no prefix.`
  }

  content += `Examples:`

  const examples = parameters
    .filter((_) => _.environment?.enabled)
    .slice(0, 3)
    .map((_) =>
      _.environment!.namespaces.length > 0
        ? `${
          Term.colors.secondary(
            Text.toEnvarNameCase(_.environment!.namespaces[0]!) + `_`,
          )
        }${Term.colors.positive(Text.toEnvarNameCase(_.name.canonical))}`
        : Term.colors.positive(Text.toEnvarNameCase(_.name.canonical))
    )
    .map((_) => `${_}="..."`)

  return Tex.block(($) =>
    $.text(content).list(
      {
        bullet: {
          graphic: Text.chars.arrowRight,
        },
      },
      examples,
    )
  )
}

const parameterDefault = (parameter: Parameter) => {
  if (parameter._tag === `Exclusive`) {
    return Term.colors.dim(`–`)
  }

  const optionality = parameter.type.metadata.optionality

  if (optionality._tag === `optional`) {
    return Term.colors.secondary(`undefined`)
  }

  if (optionality._tag === `default`) {
    const valueOrError = Err.tryCatch(() => optionality.getValue())
    if (valueOrError instanceof Error) {
      return ansis.bold(Term.colors.alert(`Error trying to render this default: ${valueOrError.message}`))
    }
    return Term.colors.secondary(String(valueOrError))
  }

  return labels.required
}

const labels = {
  required: ansis.bold(ansis.black(Term.colors.alertBoldBg(` REQUIRED `))),
}

const parameterName = (parameter: Parameter) => {
  const isRequired = (parameter._tag === `Basic` && parameter.type.metadata.optionality._tag === `required`)
    || (parameter._tag === `Exclusive` && parameter.group.optionality._tag === `required`)
  const nameColor = isRequired ? Term.colors.positiveBold : Term.colors.positive

  return Tex.block(($) =>
    $
      .block({ style: nameColor }, parameter.name.canonical)
      .block(Term.colors.dim(parameter.name.aliases.long.join(`, `)) || null)
      .block(Term.colors.dim(parameter.name.short ?? ``) || null)
      .block(Term.colors.dim(parameter.name.aliases.long.join(`, `)) || null)
  )
}

const parameterEnvironment = (parameter: Parameter, settings: Settings.Output) => {
  return parameter.environment?.enabled
    ? Term.colors.secondary(Text.chars.check)
      + (parameter.environment.enabled && parameter.environment.namespaces.length === 0
        ? ` ` + Term.colors.dim(Text.toEnvarNameCase(parameter.name.canonical))
        : parameter.environment.enabled
            && parameter.environment.namespaces.filter(
                // TODO settings normalized should store prefix in camel case
                (_) => !settings.parameters.environment.$default.prefix.includes(Str.Case.snake(_)),
              ).length > 0
        ? ` `
          + Term.colors.dim(
            parameter.environment.namespaces
              .map((_) => `${Text.toEnvarNameCase(_)}_${Text.toEnvarNameCase(parameter.name.canonical)}`)
              .join(` ${Text.chars.pipe} `),
          )
        : ``)
    : Term.colors.dim(Text.chars.x)
}

const title = (string: string) => {
  return Text.line(string.toUpperCase())
}
