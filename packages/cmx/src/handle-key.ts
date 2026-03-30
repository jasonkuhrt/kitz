import type { AppMapRoot } from './app-map.js'
import { AppMap } from './app-map.js'
import type { ControlsConfig } from './controls.js'
import { Controls } from './controls.js'
import { Session } from './session.js'
import type { HandleKeyResult } from './handle-key-result.js'
import { HandleKeyResult as HKR } from './handle-key-result.js'
import type { Layer } from 'effect'
import type { MatcherService } from './matcher.js'
import { Matcher } from './matcher.js'

/** Consumer-provided Layer whose service type is erased at storage boundaries. */
type AnyLayer = Layer.Layer<any>

/** Context passed with each handleKey call. */
export interface HandleKeyContext {
  readonly path: ReadonlyArray<string>
  /**
   * Per-call Effect layers keyed by name. Consumers provide runtime context
   * (e.g. selected item IDs from React state) to capabilities via layers.
   *
   * These layers are merged with static AppMap node layers when building
   * the executable Effect for a resolved capability.
   */
  readonly layers?: Record<string, AnyLayer>
  /**
   * Consumer state used for conditional shortcut evaluation.
   * Shortcuts with an `if` pattern are only active when `Pat.isMatch(state, if)` is true.
   */
  readonly state?: Record<string, unknown>
}

/** Active session wrapping the Session state machine. */
interface ActiveSession {
  session: ReturnType<typeof Session.create>
  path: ReadonlyArray<string>
}

/**
 * Create the handleKey function.
 * This is the two-tier dispatch that routes all keys.
 *
 * Tier 1 (no active session): checks Controls for openPalette, then checks
 * shortcuts. Creates a Session on match.
 *
 * Tier 2 (active session): delegates all key processing to the Session state
 * machine, which coordinates command resolution, slot resolution, and effect
 * building.
 */
export const createHandleKey = (
  appMap: AppMapRoot,
  controls: ControlsConfig,
  matcher: MatcherService = Matcher.fuzzy(),
) => {
  let active: ActiveSession | null = null
  let cachedPath: ReadonlyArray<string> = []

  const handleKey = (key: string, context: HandleKeyContext): HandleKeyResult => {
    const pathChanged =
      context.path.length !== cachedPath.length || context.path.some((s, i) => s !== cachedPath[i])

    if (pathChanged) {
      cachedPath = context.path
      // If the palette is open and the path changed (user navigated),
      // rebuild the session so scope reflects the new position.
      // Without this, the palette searches the old scope.
      if (active) {
        active = createSession(context)
      }
    }

    // Update dynamic layers on the active session if they changed
    if (active && context.layers) {
      active.session.setDynamicLayers(context.layers)
    }

    if (active) {
      return handleTier2(key, active)
    }

    return handleTier1(key, context)
  }

  const createSession = (context: HandleKeyContext): ActiveSession => {
    const scope = AppMap.computeScope(appMap, context.path, context)
    const session = Session.create(scope.commands, scope.proximities, {
      dynamicLayers: context.layers ?? {},
      scopeLayers: collectScopeLayers(appMap, context.path),
      matcher,
    })
    return { session, path: context.path }
  }

  const handleTier1 = (key: string, context: HandleKeyContext): HandleKeyResult => {
    // Check Controls for openPalette first
    const tier1Action = Controls.classifyTier1(controls, key)
    if (tier1Action === 'openPalette') {
      active = createSession(context)
      return HKR.BeginPalette(active.session.getResolution())
    }

    // Check shortcuts
    const kb = AppMap.resolveShortcut(appMap, context.path, key, context)
    if (kb) {
      active = createSession(context)
      // Pre-position at the shortcut's command
      const resolution = active.session.getResolution()
      const matchingChoice = resolution.choices.find(
        (c) =>
          c.token === kb.command.name || c.token.endsWith(` ${kb.command.name}`),
      )
      if (matchingChoice) {
        const afterTake = active.session.choiceTake(matchingChoice)
        // If the shortcut resolves to an immediately executable command (no slots),
        // clear the active session so the next key routes through Tier 1.
        // Without this, the stale session hijacks subsequent keystrokes.
        if (afterTake.executable) {
          active = null
        }
        return HKR.BeginShortcut(afterTake, afterTake.executable)
      }
      return HKR.BeginPalette(resolution)
    }

    return HKR.Nil()
  }

  const handleTier2 = (key: string, current: ActiveSession): HandleKeyResult => {
    const action = Controls.classify(controls, key)
    if (!action) return HKR.Nil()

    const session = current.session

    switch (action) {
      case 'cancel': {
        active = null
        return HKR.Close()
      }

      case 'confirm': {
        const res = session.confirm()
        if (res.executable) {
          active = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'complete': {
        const res = session.choiceTakeTop()
        if (res.executable) {
          active = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'backspace': {
        const res = session.queryUndo()
        return HKR.Resolution(res)
      }

      case 'toggleMode': {
        const res = session.toggleMode()
        return HKR.Resolution(res)
      }

      case 'space': {
        const res = session.queryPush(' ')
        if (res.executable) {
          active = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'printable': {
        const res = session.queryPush(key)
        if (res.executable) {
          active = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'openPalette': {
        return HKR.Nil()
      }
    }
  }

  return handleKey
}

/**
 * Collect static layers from the AppMap scope chain (root to target path).
 * These are merged with dynamic per-call layers when building the executable effect.
 */
const collectScopeLayers = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
): ReadonlyArray<AnyLayer> => {
  const layers: AnyLayer[] = []
  if (root.layer) layers.push(root.layer)

  let current: AppMapRoot = root
  for (const segment of path) {
    const child = current.children.find((c: { name: string }) => c.name === segment)
    if (!child) break
    if (child.layer) layers.push(child.layer)
    current = child as AppMapRoot
  }

  return layers
}
