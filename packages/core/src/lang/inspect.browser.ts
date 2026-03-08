type InspectParameters = [unknown, unknown?]

export const inspect = (...args: InspectParameters) => {
  // Browser-safe version - basic JSON stringify
  const [value, _options] = args
  return JSON.stringify(value, null, 2)
}
