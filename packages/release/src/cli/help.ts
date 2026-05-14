const rootCommands = [
  { usage: 'apply [options]', description: 'Execute the release plan' },
  { usage: 'archive export [options]', description: 'Export a release audit archive' },
  { usage: 'conformance run [options]', description: 'Run publishing provider conformance checks' },
  { usage: 'doctor [options]', description: 'Run release doctor checks and publishability audits' },
  {
    usage: 'explain [pkg] [options]',
    description: 'Explain why a package is primary, cascade, or unchanged',
  },
  { usage: 'forecast [options]', description: 'Render a release forecast' },
  {
    usage: 'history [options]',
    description: 'Inspect publish state and history from the PR preview comment',
  },
  { usage: 'init [options]', description: 'Initialize release configuration' },
  { usage: 'inspect <package>@<version>', description: 'Inspect published package legitimacy' },
  { usage: 'matrix verify [options]', description: 'Verify package-manager capability matrix' },
  { usage: 'notes [pkg] [options]', description: 'Show unreleased release notes' },
  {
    usage: 'pr <preview|title <suggest|apply>>',
    description: 'Update the PR preview comment or manage the canonical PR title header',
  },
  { usage: 'plan [options]', description: 'Generate a release plan' },
  { usage: 'preview [options]', description: 'Preview the frozen release plan' },
  { usage: 'prove [options]', description: 'Write plan-bound publishing proof' },
  { usage: 'reconcile [options]', description: 'Reconcile remote state with the plan' },
  { usage: 'rehearse [options]', description: 'Build exact release artifacts' },
  { usage: 'graph [options]', description: 'Render the release execution DAG for the active plan' },
  { usage: 'prune [options]', description: 'Prune local release artifacts' },
  { usage: 'resume [options]', description: 'Resume an interrupted release workflow' },
  { usage: 'status [options]', description: 'Inspect durable workflow state for the active plan' },
  { usage: 'ui', description: 'Open the interactive release dashboard' },
  { usage: 'validate-setup [options]', description: 'Validate release setup without planning' },
] as const

const helpFlags = ['-h', '--help'] as const

export const isRootHelpRequest = (args: readonly string[]): boolean => {
  return args.length === 0 || args.some((arg) => helpFlags.includes(arg as '-h' | '--help'))
}

export const formatRootHelp = (): string => {
  const usageWidth = Math.max(...rootCommands.map((command) => command.usage.length))
  const commandLines = rootCommands.map((command) => {
    return `  ${command.usage.padEnd(usageWidth)}  ${command.description}`
  })

  return [
    'Usage: release <command> [options]',
    '',
    'Commands:',
    ...commandLines,
    '',
    'Run `release <command> -h` for command-specific help.',
  ].join('\n')
}
