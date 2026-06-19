import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Array as A, Effect, Order } from 'effect'
import type { Package } from '../../api/analyzer/workspace.js'

export const createPackagePickerOptions = (packages: readonly Package[]) =>
  A.map(
    A.sortWith(packages, (pkg) => pkg.scope, Order.String),
    (pkg) => ({
      label: pkg.scope,
      value: pkg.name.moniker,
      detail: pkg.name.moniker,
    }),
  )

export type ExplainPackageSelection =
  | { readonly _tag: 'resolved'; readonly value: string }
  | { readonly _tag: 'missing'; readonly message: string }

const renderMissingPackageMessage = (
  reason: Cli.Picker.InteractiveCommandSelectionFailureReason,
) => {
  switch (reason) {
    case 'cancelled':
      return 'Package selection cancelled. Pass <pkg> to run without the picker.'
    case 'empty':
      return 'Package selection has no available options. Pass <pkg> explicitly.'
    default: {
      const output = Str.Builder()
      output`Missing package target. Pass <pkg>.`
      output(Cli.Picker.describeInteractiveTerminalRequirement(reason))
      return output.render()
    }
  }
}

export const resolveExplainPackage = <E, R>(params: {
  readonly pkg: string | undefined
  readonly terminal: Cli.Picker.InteractiveTerminalCapabilities
  readonly pickPackage: () => Effect.Effect<Cli.Picker.PickerResult<string>, E, R>
}) =>
  Cli.Picker.resolveInteractiveCommandSelection({
    provided: params.pkg,
    terminal: params.terminal,
    pick: params.pickPackage,
  }).pipe(
    Effect.map(
      (selection): ExplainPackageSelection =>
        selection._tag === 'resolved'
          ? selection
          : {
              _tag: 'missing',
              message: renderMissingPackageMessage(selection.reason),
            },
    ),
  )
