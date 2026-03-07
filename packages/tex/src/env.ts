export const getTerminalWidth = (fallback: number): number => {
  if (typeof process === `undefined`) return fallback
  const envColumns = parseInt(process.env[`COLUMNS`] ?? ``, 10)
  if (!Number.isNaN(envColumns) && envColumns > 0) return envColumns
  return process.stdout?.columns ?? fallback
}
