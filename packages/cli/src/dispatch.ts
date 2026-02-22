import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Err, Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Mod } from '@kitz/mod'
import { Effect, ParseResult, Schema as S } from 'effect'
import { parseArgv } from './argv.js'
import { type CommandTarget, getCommandTarget } from './commend-target.js'

// ============================================
// Errors
// ============================================

const baseTags = ['kit', 'cli', 'dispatch'] as const

/**
 * Commands directory not found at the specified path.
 */
export const DiscoverCommandsDirNotFoundError = Err.TaggedContextualError(
  'KitCliDiscoverCommandsDirNotFoundError',
  baseTags,
  {
    context: S.Struct({
      path: Fs.Path.AbsDir.Schema,
    }),
    message: (ctx) => `Commands directory not found: ${Fs.Path.toString(ctx.path)}`,
    cause: S.instanceOf(Error),
  },
)

/**
 * Instance type of {@link DiscoverCommandsDirNotFoundError}.
 */
export type DiscoverCommandsDirNotFoundError = InstanceType<typeof DiscoverCommandsDirNotFoundError>

// ============================================
// Functions
// ============================================

/**
 * Dispatches CLI commands by discovering and executing command modules.
 *
 * Scans the specified directory for command files, matches the command from argv,
 * and dynamically imports and executes the appropriate command module.
 *
 * @param commandsDirPath - The absolute path to the directory containing command modules
 * @returns An Effect that requires Env and resolves when the command execution completes
 *
 * @example
 * // Directory structure:
 * // commands/
 * //   build.js
 * //   test.js
 * //   $default.js
 *
 * import { Env, Fs } from '@wollybeard/kit'
 * import { NodeFileSystem } from '@effect/platform-node'
 * import { Effect, Layer } from 'effect'
 *
 * const commandsDir = Fs.Path.AbsDir.decodeStringSync('/path/to/commands/')
 * const layer = Layer.merge(Env.Live, NodeFileSystem.layer)
 * await Effect.runPromise(Effect.provide(dispatch(commandsDir), layer))
 * // If argv is ['node', 'cli.js', 'build'], imports and executes build.js
 * // If argv is ['node', 'cli.js'], imports and executes $default.js
 */
export const dispatch = (
  commandsDirPath: Fs.Path.AbsDir,
): Effect.Effect<
  void,
  DiscoverCommandsDirNotFoundError | PlatformError | ParseResult.ParseError | Mod.ImportError,
  Env.Env | FileSystem.FileSystem
> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const commandFiles = yield* discoverCommandPointers(commandsDirPath)

    const argv = yield* parseArgv(env.argv)
    const commandTarget = getCommandTarget(argv)
    const moduleTargetName = getModuleName(commandTarget)
    const commandFile = commandFiles.find(file => Fs.Path.stem(file) === moduleTargetName)

    if (!commandFile) {
      const availableCommands = commandFiles.map(file => `${Str.Char.rightwardsArrow} ${Fs.Path.stem(file)}`).join(
        Str.Char.newline,
      )
      if (moduleTargetName === `$default`) {
        console.error(`Error: You must specify a command.\n\nAvailable commands:\n${availableCommands}`)
      } else {
        console.error(`Error: No such command "${moduleTargetName}".\n\nAvailable commands:\n${availableCommands}`)
      }
      return env.exit(1)
    }

    yield* Mod.dynamicImportFile(commandFile)
  })

const getModuleName = (commandTarget: CommandTarget): string => {
  const name = commandTarget.type === `sub` ? commandTarget.name : `$default`
  return name
}

/**
 * Discovers available command modules in a directory.
 *
 * Scans the directory for JavaScript/TypeScript files and returns their paths.
 * Filters out build artifacts (.map, .d.ts).
 *
 * @param commandsDirPath - The absolute path to the directory containing command modules
 * @returns An Effect resolving to an array of absolute file paths
 *
 * @example
 * ```ts
 * const commandsDir = Fs.Path.AbsDir.decodeStringSync('/path/to/commands/')
 * const commands = yield* discoverCommandPointers(commandsDir)
 * // Returns AbsFile[] - use Fs.Path.stem() to get command names
 * ```
 */
export const discoverCommandPointers = (
  commandsDirPath: Fs.Path.AbsDir,
): Effect.Effect<Fs.Path.AbsFile[], DiscoverCommandsDirNotFoundError | PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const entries = yield* Fs.read(commandsDirPath).pipe(
      Effect.catchTag('SystemError', (cause) =>
        Effect.fail(
          new DiscoverCommandsDirNotFoundError({
            context: { path: commandsDirPath },
            cause,
          }),
        )),
    )

    return entries
      .filter(Fs.Path.AbsFile.is)
      .filter(file => {
        const ext = Fs.Path.extension(file)
        return !Fs.Path.Extension.Extensions.buildArtifacts.some(e => e === ext)
      })
  })
