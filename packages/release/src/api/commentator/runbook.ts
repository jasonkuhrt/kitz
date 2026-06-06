import * as Rules from '../lint/rules/__.js'
import type { DoctorSummary } from './doctor.js'

/** Lint rules whose verification is deferred to the operator's local machine for manual previews. */
const manualPreviewDeferredRules = [
  Rules.EnvNpmAuthenticated,
  Rules.EnvGitClean,
  Rules.EnvGitRemote,
] as const

const appendReleaseCommand = (releaseCommand: string, suffix: string): string =>
  `${releaseCommand} ${suffix}`

const renderDoctorCommandSuffix = (
  diffRemote: string | undefined,
  extraArgs: readonly string[] = [],
): string => {
  const args = ['doctor']
  if (diffRemote && diffRemote !== 'origin') {
    args.push(`--remote ${diffRemote}`)
  }
  args.push(...extraArgs)
  return args.join(' ')
}

/**
 * Build the manual-preview runbook and deferred-check entries for the doctor summary.
 *
 * Owns the command-string templating: the ordered runbook commands an operator
 * runs to publish a manual ephemeral preview, plus the deferred local checks
 * that this comment cannot verify on the operator's machine.
 */
export const buildManualPreviewRunbook = (params: {
  readonly prepareCommands: readonly string[]
  readonly releaseCommand: string
  readonly prNumber: number
  readonly distTag: string
  readonly diffRemote: string | undefined
}): {
  readonly runbook: NonNullable<DoctorSummary['runbook']>
  readonly deferredChecks: DoctorSummary['deferredChecks']
} => ({
  runbook: {
    title: 'Manual Preview Runbook',
    commands: [
      ...params.prepareCommands,
      `PR_NUMBER=${String(params.prNumber)} ${appendReleaseCommand(params.releaseCommand, 'plan --lifecycle ephemeral')}`,
      appendReleaseCommand(params.releaseCommand, renderDoctorCommandSuffix(params.diffRemote)),
      appendReleaseCommand(params.releaseCommand, 'apply --yes'),
    ],
    note:
      'Step 2 writes the exact ephemeral publish plan to `.release/plan.json`. ' +
      `Step 4 publishes those packages to the \`${params.distTag}\` dist-tag automatically.`,
  },
  deferredChecks: manualPreviewDeferredRules.flatMap((rule) =>
    rule.data.preventsDescriptions && rule.data.preventsDescriptions.length > 0
      ? [
          {
            label: rule.data.description,
            ruleId: rule.data.id,
            preventsDescriptions: rule.data.preventsDescriptions,
            checkCommand: appendReleaseCommand(
              params.releaseCommand,
              renderDoctorCommandSuffix(params.diffRemote, [`--onlyRule ${rule.data.id}`]),
            ),
          },
        ]
      : [],
  ),
})
