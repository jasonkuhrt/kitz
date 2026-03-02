import { Str } from '@kitz/core'
import { Either } from 'effect'
import { Errors } from '../../Errors/_.js'
import { stripeNegatePrefixLoose } from '../../helpers.js'
import type { Index } from '../../lib/prelude.js'
import { findByName, isOrHasType } from '../../Parameter/helpers/CommandParameter.js'
import type { Parameter } from '../../Parameter/types.js'
import { isNegated, parseSerializedValue, stripeDashPrefix } from '../helpers.js'
import type { ArgumentReport } from '../types.js'

export type RawInputs = string[]

export type GlobalParseErrors = InstanceType<typeof Errors.Global.ErrorUnknownFlag>

export type LocalParseErrors =
  | InstanceType<typeof Errors.ErrorMissingArgument>
  | InstanceType<typeof Errors.ErrorDuplicateLineArg>
  | InstanceType<typeof Errors.ErrorInvalidArgument>

interface ParsedInputs {
  globalErrors: GlobalParseErrors[]
  reports: Index<ArgumentReport>
}

/**
 * Parse line input into an intermediary representation that is suited to comparison against
 * the parameter specs.
 */
export const parse = (rawLineInputs: RawInputs, parameters: Parameter[]): ParsedInputs => {
  const globalErrors: GlobalParseErrors[] = []

  const rawLineInputsPrepared = rawLineInputs
    .flatMap((lineInput) => {
      if (!isShortFlag(lineInput)) return [lineInput]
      return stripeShortFlagPrefixUnsafe(lineInput).split(``).map(addShortFlagPrefix)
    })
    .flatMap((lineInput) => {
      if (lineInput.trim() === `=`) return []
      if (!isFlag(lineInput.trim())) return [lineInput]
      // Nodejs will not get us empty string input so we are guaranteed a flag name here.
      const [flag, ...value] = lineInput.trim().split(`=`) as [string, ...string[]]
      if (value.length === 0) return [flag]
      if (value.join(``) === ``) return [flag]
      return [flag, value.join(`=`)]
    })

  const reports: Index<ArgumentReport> = {}

  let currentReport: null | { report: ArgumentReport; pending: boolean } = null

  const finishPendingReport = (pendingReport: { report: ArgumentReport; pending: boolean }) => {
    if (pendingReport.pending) {
      /**
       * We have gotten something like this: --foo --bar.
       * We are parsing "foo". Its spec could be a union containing a boolean or just a straight up boolean, or something else.
       * If union with boolean or boolean then we interpret foo argument as being a boolean.
       * Otherwise it is an error.
       */
      if (isOrHasType(pendingReport.report.parameter, `TypeBoolean`)) {
        pendingReport.report.value = {
          value: true,
          _tag: `boolean`,
          negated: isNegated(Str.Case.camel(pendingReport.report.source.name)),
        }
      } else {
        pendingReport.report.errors.push(
          new Errors.ErrorMissingArgument({
            context: { parameter: pendingReport.report.parameter },
          }),
        )
      }
      pendingReport.pending = false
    }
  }

  // Do processing

  for (const rawLineInput of rawLineInputsPrepared) {
    if (isFlag(rawLineInput)) {
      if (currentReport) {
        finishPendingReport(currentReport)
        currentReport = null
      }

      const flagNameNoDashPrefix = stripeDashPrefix(rawLineInput)
      const flagNameNoDashPrefixCamel = Str.Case.camel(flagNameNoDashPrefix)
      const flagNameNoDashPrefixNoNegate = stripeNegatePrefixLoose(flagNameNoDashPrefixCamel)
      const parameter = findByName(flagNameNoDashPrefixCamel, parameters)
      if (!parameter) {
        globalErrors.push(
          new Errors.Global.ErrorUnknownFlag({
            context: { flagName: flagNameNoDashPrefixNoNegate },
          }),
        )
        continue
      }

      const existing = reports[parameter.name.canonical]
      if (existing) {
        // TODO Handle once we support multiple values (arrays).
        // TODO richer structured info about the duplication. For example if
        // duplicated across aliases, make it easy to report a nice message explaining that.
        existing.errors.push(
          new Errors.ErrorDuplicateLineArg({
            context: { parameter, flagName: flagNameNoDashPrefixNoNegate },
          }),
        )
        continue
      }

      currentReport = {
        pending: true,
        report: {
          parameter,
          errors: [],
          value: { _tag: `undefined`, value: undefined },
          source: {
            _tag: `line`,
            name: flagNameNoDashPrefix,
          },
        },
      }

      reports[parameter.name.canonical] = currentReport.report

      continue
    } else if (currentReport) {
      const parsed = parseSerializedValue(
        currentReport.report.parameter.name.canonical,
        rawLineInput,
        currentReport.report.parameter,
      )
      if (Either.isRight(parsed)) {
        currentReport.report.value = parsed.right
      } else {
        const errorMessage = parsed.left.message.replace(/^Deserialization failed: /, ``)
        currentReport.report.errors.push(
          new Errors.ErrorInvalidArgument({
            context: {
              spec: currentReport.report.parameter,
              validationErrors: [errorMessage],
              value: rawLineInput,
            },
          }),
        )
      }
      currentReport.pending = false
      currentReport = null
      continue
    } else {
      // TODO We got an argument without a flag, we should report an error? Or just ignore?
    }
  }

  if (currentReport) {
    finishPendingReport(currentReport)
    currentReport = null
  }

  return {
    globalErrors,
    reports,
  }
}

const isFlag = (lineInput: string) => isLongFlag(lineInput) || isShortFlag(lineInput)

const isLongFlag = (lineInput: string) => lineInput.trim().startsWith(`--`)

const isShortFlag = (lineInput: string) => lineInput.trim().startsWith(`-`) && !lineInput.trim().startsWith(`--`)

const stripeShortFlagPrefixUnsafe = (lineInput: string) => lineInput.trim().slice(1)

const addShortFlagPrefix = (lineInput: string) => `-${lineInput}`
