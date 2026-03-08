const rootCommands = [
  { usage: 'apply [options]', description: 'Execute the release plan' },
  { usage: 'doctor [options]', description: 'Run release doctor checks and publishability audits' },
  { usage: 'forecast [options]', description: 'Render a release forecast' },
  { usage: 'init [options]', description: 'Initialize release configuration' },
  { usage: 'notes [pkg] [options]', description: 'Show unreleased release notes' },
  {
    usage: 'pr <preview|title <suggest|apply>>',
    description: 'Update the PR preview comment or manage the canonical PR title header',
  },
  {
    usage: 'plan --lifecycle <official|candidate|ephemeral> [options]',
    description: 'Generate a release plan',
  },
] as const

const helpFlags = new Set(['-h', '--help'])

export const isRootHelpRequest = (args: readonly string[]): boolean => {
  return args.length === 0 || args.some((arg) => helpFlags.has(arg))
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
