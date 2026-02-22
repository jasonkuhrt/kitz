import type { inspect as nodeInspect } from 'util'

type InspectParameters = Parameters<typeof nodeInspect>

export const inspect = (...args: InspectParameters) => {
  // Browser-safe version - basic JSON stringify
  const [value, _options] = args
  return JSON.stringify(value, null, 2)
}
