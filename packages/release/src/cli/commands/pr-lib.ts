import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Array as A, Effect, Option } from 'effect'

export const formatHelp = () =>
  [
    'Usage: release pr <preview|title <suggest|apply>>',
    '',
    'Commands:',
    '  preview         Update the release preview comment and fail on blocking preview checks',
    '                  Pass `--check-only` to run checks without updating the comment',
    '                  Pass `--remote <name>` to override the PR diff remote for this run',
    '  title suggest   Show the canonical release header and suggested PR title',
    '  title apply     Update the connected PR title by replacing only its header',
  ].join('\n')

export type ParsedAction =
  | { readonly _tag: 'preview'; readonly checkOnly: boolean; readonly remote?: string }
  | { readonly _tag: 'title'; readonly action: 'suggest' | 'apply' }

export const prActionPickerOptions = Cli.Picker.defineOptions([
  {
    label: 'preview',
    value: { _tag: 'preview', checkOnly: false },
    detail: 'Update the release preview comment for the connected pull request.',
  },
  {
    label: 'title suggest',
    value: { _tag: 'title', action: 'suggest' },
    detail: 'Show the canonical PR title header without changing GitHub.',
  },
  {
    label: 'title apply',
    value: { _tag: 'title', action: 'apply' },
    detail: 'Rewrite the connected PR title header on GitHub.',
  },
])

export type ParsedActionResolution =
  | { readonly _tag: 'resolved'; readonly action: ParsedAction }
  | {
      readonly _tag: 'invalid'
      readonly message: string
      readonly showHelp: boolean
    }

const normalizeRemoteArg = (value: string | undefined) => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.startsWith('--')) return null
  return normalized
}

export const parseAction = (args: readonly string[]): ParsedAction | null => {
  if (args[0] === 'preview') {
    const previewArgs = A.drop(args, 1)
    let checkOnly = false
    let remote: string | undefined

    for (let index = 0; index < previewArgs.length; index += 1) {
      const arg = A.getUnsafe(previewArgs, index)
      if (arg === '--check-only') {
        checkOnly = true
        continue
      }
      if (arg === '--remote') {
        const normalizedRemote = normalizeRemoteArg(
          Option.getOrUndefined(A.get(previewArgs, index + 1)),
        )
        if (!normalizedRemote) {
          return null
        }
        remote = normalizedRemote
        index += 1
        continue
      }
      return null
    }

    return { _tag: 'preview', checkOnly, ...(remote ? { remote } : {}) }
  }

  if (args.length < 2 || args[0] !== 'title') return null
  if (args[1] === 'suggest' || args[1] === 'apply') {
    return { _tag: 'title', action: args[1] }
  }
  return null
}

export const resolvePrAction = <E, R>(params: {
  readonly args: readonly string[]
  readonly terminal: Cli.Picker.InteractiveTerminalCapabilities
  readonly pickAction: () => Effect.Effect<Cli.Picker.PickerResult<ParsedAction>, E, R>
}): Effect.Effect<ParsedActionResolution, E, R> => {
  if (params.args.length > 0) {
    const action = parseAction(params.args)
    return Effect.succeed(
      action
        ? {
            _tag: 'resolved',
            action,
          }
        : {
            _tag: 'invalid',
            message: 'Expected `release pr preview` or `release pr title <suggest|apply>`.',
            showHelp: true,
          },
    )
  }

  return Cli.Picker.resolveInteractiveCommandSelection({
    provided: undefined,
    terminal: params.terminal,
    pick: params.pickAction,
  }).pipe(
    Effect.map((selection) => {
      if (selection._tag === 'resolved') {
        return {
          _tag: 'resolved',
          action: selection.value,
        }
      }

      switch (selection.reason) {
        case 'cancelled':
          return {
            _tag: 'invalid',
            message:
              'PR action selection cancelled. Re-run with `release pr preview` or `release pr title <suggest|apply>`.',
            showHelp: false,
          }
        case 'empty':
          return {
            _tag: 'invalid',
            message:
              'PR action selection has no available options. Re-run with `release pr preview` or `release pr title <suggest|apply>`.',
            showHelp: false,
          }
        default: {
          const output = Str.Builder()
          output`Missing PR action. Pass \`release pr preview\` or \`release pr title <suggest|apply>\`.`
          output(Cli.Picker.describeInteractiveTerminalRequirement(selection.reason))
          return {
            _tag: 'invalid',
            message: output.render(),
            showHelp: true,
          }
        }
      }
    }),
  )
}
