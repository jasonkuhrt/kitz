import { lowerCaseObjectKeys } from './helpers.js'

export const getLowerCaseEnvironment = (): NodeJS.ProcessEnv =>
  lowerCaseObjectKeys(process.env)

export const getTerminalWidth = (fallback: number): number => {
  if (typeof process === `undefined`) return fallback
  const envColumns = parseInt(process.env[`COLUMNS`] ?? ``, 10)
  if (!Number.isNaN(envColumns) && envColumns > 0) return envColumns
  return process.stdout?.columns ?? fallback
}

export const isTestingOak = (): boolean => process.env[`testing_oak`] === `true`
