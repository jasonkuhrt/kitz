import type { AppMapRoot } from './app-map.js'
import type { ControlsConfig } from './controls.js'
import { Controls } from './controls.js'
import { createHandleKey, type HandleKeyContext } from './handle-key.js'
import type { HandleKeyResult } from './handle-key-result.js'
import type { MatcherService } from './matcher.js'

/** The Cmx service instance. */
export interface CmxService {
  readonly handleKey: (key: string, context: HandleKeyContext) => HandleKeyResult
}

/** Create a Cmx service from an AppMap and optional Controls/Matcher config. */
export const createCmx = (
  appMap: AppMapRoot,
  controls: ControlsConfig = Controls.defaults,
  matcher?: MatcherService,
): CmxService => {
  const handleKey = createHandleKey(appMap, controls, matcher)
  return { handleKey }
}
