import type { AnyCommand } from './command.js'
import type { AppMapRoot } from './app-map.js'
import { AppMap } from './app-map.js'
import type { ControlsConfig, ControlAction } from './controls.js'
import { Controls } from './controls.js'
import { CommandResolver } from './command-resolver.js'
import type { HandleKeyResult } from './handle-key-result.js'
import { HandleKeyResult as HKR } from './handle-key-result.js'
import type { Resolution } from './resolution.js'
import type { Layer } from 'effect'

/** Context passed with each handleKey call. */
export interface HandleKeyContext {
  readonly path: ReadonlyArray<string>
  readonly layers?: Record<string, Layer.Layer<any>>
}

/** Internal session state. */
interface Session {
  resolver: ReturnType<typeof CommandResolver.create>
  /** The path this session was created for. */
  path: ReadonlyArray<string>
}

/**
 * Create the handleKey function.
 * This is the two-tier dispatch that routes all keys.
 */
export const createHandleKey = (appMap: AppMapRoot, controls: ControlsConfig) => {
  let session: Session | null = null
  let cachedPath: ReadonlyArray<string> = []

  const handleKey = (key: string, context: HandleKeyContext): HandleKeyResult => {
    // Cache scope computation — only recompute when path changes
    const pathChanged =
      context.path.length !== cachedPath.length || context.path.some((s, i) => s !== cachedPath[i])

    if (pathChanged) {
      cachedPath = context.path
    }

    // If a session is active, route to Tier 2
    if (session) {
      return handleTier2(key, session)
    }

    // Tier 1: no active session
    return handleTier1(key, context)
  }

  const handleTier1 = (key: string, context: HandleKeyContext): HandleKeyResult => {
    // Check Controls for openPalette first
    const tier1Action = Controls.classifyTier1(controls, key)
    if (tier1Action === 'openPalette') {
      const scope = AppMap.computeScope(appMap, context.path)
      const resolver = CommandResolver.create(scope.commands, scope.proximities)
      session = { resolver, path: context.path }
      return HKR.BeginPalette(resolver.getResolution())
    }

    // Check keybindings
    const kb = AppMap.resolveKeybinding(appMap, context.path, key)
    if (kb) {
      const scope = AppMap.computeScope(appMap, context.path)
      const resolver = CommandResolver.create(scope.commands, scope.proximities)
      // Pre-position at the keybinding's command
      const resolution = resolver.getResolution()
      // Find the command's path in the choices
      const matchingChoice = resolution.choices.find(
        (c) =>
          c.token === kb.command.name ||
          resolution.choices.some((ch) => ch.token.endsWith(` ${kb.command.name}`)),
      )
      if (matchingChoice) {
        const afterTake = resolver.choiceTake(matchingChoice)
        session = { resolver, path: context.path }
        return HKR.BeginShortcut(afterTake, afterTake.executable)
      }
      // Fallback: just begin a palette session
      session = { resolver, path: context.path }
      return HKR.BeginPalette(resolution)
    }

    return HKR.Nil()
  }

  const handleTier2 = (key: string, currentSession: Session): HandleKeyResult => {
    const action = Controls.classify(controls, key)
    if (!action) return HKR.Nil()

    const resolver = currentSession.resolver

    switch (action) {
      case 'cancel': {
        session = null
        return HKR.Close()
      }

      case 'confirm': {
        const current = resolver.getResolution()
        if (current.executable) {
          session = null
          return HKR.Execute(current)
        }
        // Not executable — take top choice to advance
        const res = resolver.choiceTakeTop()
        if (res.executable) {
          session = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'complete': {
        const res = resolver.choiceTakeTop()
        if (res.executable) {
          session = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'backspace': {
        const res = resolver.queryUndo()
        return HKR.Resolution(res)
      }

      case 'toggleMode': {
        const res = resolver.toggleMode()
        return HKR.Resolution(res)
      }

      case 'space': {
        const res = resolver.queryPush(' ')
        if (res.executable) {
          session = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'printable': {
        const res = resolver.queryPush(key)
        if (res.executable) {
          session = null
          return HKR.Execute(res)
        }
        return HKR.Resolution(res)
      }

      case 'openPalette': {
        // Already in a session — treat as printable or ignore
        return HKR.Nil()
      }
    }
  }

  return handleKey
}
