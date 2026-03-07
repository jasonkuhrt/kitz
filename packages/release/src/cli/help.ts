const rootCommands = [
  { usage: 'apply [options]', description: 'Execute the release plan' },
  { usage: 'init [options]', description: 'Initialize release configuration' },
  { usage: 'lint [options]', description: 'Run release lint rules' },
  { usage: 'log [pkg] [options]', description: 'Show unreleased changes' },
  { usage: 'plan <stable|preview|pr> [options]', description: 'Generate a release plan' },
  { usage: 'render <comment|tree> [options]', description: 'Render forecast data' },
  { usage: 'status [pkg...]', description: 'Show unreleased changes and cascades' },
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
