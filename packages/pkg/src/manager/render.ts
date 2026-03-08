import type { PackageManager } from './PackageManager.js'

/**
 * Render a package-manager-specific script invocation.
 */
export const renderScriptCommand = (
  manager: PackageManager,
  script: string,
  args?: string,
): string => {
  const trimmedArgs = args?.trim()

  switch (manager) {
    case 'bun':
      return trimmedArgs ? `bun run ${script} ${trimmedArgs}` : `bun run ${script}`
    case 'pnpm':
      return trimmedArgs ? `pnpm ${script} ${trimmedArgs}` : `pnpm ${script}`
    case 'yarn':
      return trimmedArgs ? `yarn ${script} ${trimmedArgs}` : `yarn ${script}`
    case 'npm':
      return trimmedArgs ? `npm run ${script} -- ${trimmedArgs}` : `npm run ${script}`
    case 'unknown':
      return trimmedArgs ? `${script} ${trimmedArgs}` : script
  }
}
