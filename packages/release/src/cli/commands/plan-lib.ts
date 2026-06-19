import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Effect } from 'effect'
import type { Lifecycle } from '../../api/version/models/lifecycle.js'

export const lifecyclePickerOptions = Cli.Picker.defineOptions([
  {
    label: 'official',
    value: 'official',
    detail: 'Publish semver releases to the default npm dist-tag.',
  },
  {
    label: 'candidate',
    value: 'candidate',
    detail: 'Publish prereleases to the candidate dist-tag.',
  },
  {
    label: 'ephemeral',
    value: 'ephemeral',
    detail: 'Publish PR-scoped integration builds.',
  },
])

export type PlanLifecycleSelection =
  | { readonly _tag: 'resolved'; readonly value: Lifecycle }
  | { readonly _tag: 'missing'; readonly message: string }

const lifecycleArgument = '--lifecycle <official|candidate|ephemeral>'

const renderMissingLifecycleMessage = (
  reason: Cli.Picker.InteractiveCommandSelectionFailureReason,
) => {
  switch (reason) {
    case 'cancelled':
      return `Release lifecycle selection cancelled. Pass ${lifecycleArgument} to run without the picker.`
    case 'empty':
      return `Release lifecycle selection has no available options. Pass ${lifecycleArgument} explicitly.`
    default: {
      const output = Str.Builder()
      output`Missing release lifecycle. Pass ${lifecycleArgument}.`
      output(Cli.Picker.describeInteractiveTerminalRequirement(reason))
      return output.render()
    }
  }
}

export const resolvePlanLifecycle = <E, R>(params: {
  readonly lifecycle: Lifecycle | undefined
  readonly terminal: Cli.Picker.InteractiveTerminalCapabilities
  readonly pickLifecycle: () => Effect.Effect<Cli.Picker.PickerResult<Lifecycle>, E, R>
}) =>
  Cli.Picker.resolveInteractiveCommandSelection({
    provided: params.lifecycle,
    terminal: params.terminal,
    pick: params.pickLifecycle,
  }).pipe(
    Effect.map(
      (selection): PlanLifecycleSelection =>
        selection._tag === 'resolved'
          ? selection
          : {
              _tag: 'missing',
              message: renderMissingLifecycleMessage(selection.reason),
            },
    ),
  )
