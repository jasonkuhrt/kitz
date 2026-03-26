export const helpFlags = ['-h', '--help'] as const

export const formatHelp = (): string =>
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

const normalizeRemoteArg = (value: string | undefined): string | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.startsWith('--')) return null
  return normalized
}

export const parseAction = (args: readonly string[]): ParsedAction | null => {
  if (args[0] === 'preview') {
    const previewArgs = args.slice(1)
    let checkOnly = false
    let remote: string | undefined

    for (let index = 0; index < previewArgs.length; index += 1) {
      const arg = previewArgs[index]
      if (arg === '--check-only') {
        checkOnly = true
        continue
      }
      if (arg === '--remote') {
        const normalizedRemote = normalizeRemoteArg(previewArgs[index + 1])
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
