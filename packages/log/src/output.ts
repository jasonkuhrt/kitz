import * as Os from 'os'
import type { LogRecord } from './logger.js'
import { Renderer } from './renderer.js'
import type { Data as SettingsData } from './settings.js'

export type Output = {
  write: (record: LogRecord, settings: SettingsData) => void
}

export const defaultOutput: Output = {
  write: (record: LogRecord, settings: SettingsData) => {
    process.stdout.write(
      settings.pretty.enabled ? Renderer.render(settings.pretty, record) : JSON.stringify(record) + Os.EOL,
    )
  },
}
