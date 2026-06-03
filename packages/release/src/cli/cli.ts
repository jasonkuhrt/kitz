#!/usr/bin/env node
/**
 * Release CLI entry point.
 *
 * Runs the root `Command` tree (defined in `tree.ts`). The framework owns
 * argument parsing, `-h`/`--help`, version, and shell completions. Each command
 * provides its own domain services (via `Command.provide`); the root provides
 * the CLI `Environment` (filesystem, path, terminal, stdio, child-process
 * spawner) that the framework and any interactive prompts require.
 */
import { Platform } from '@kitz/platform'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import { release } from './tree.js'

const CliEnvironment = Layer.mergeAll(
  Platform.FileSystem.layer,
  Platform.Path.layer,
  Platform.Terminal.layer,
  Platform.Stdio.layer,
  Platform.ChildProcessSpawner.layer.pipe(
    Layer.provide(Platform.FileSystem.layer),
    Layer.provide(Platform.Path.layer),
  ),
)

Platform.Runtime.runMain(
  Command.run(release, { version: '0.0.0-kitz-release' }).pipe(Effect.provide(CliEnvironment)),
)
