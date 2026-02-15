#!/usr/bin/env node
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'

/**
 * Release CLI entry point.
 *
 * Uses file-based routing to dispatch commands from the `commands/` directory.
 * Each command is a separate module that gets dynamically imported based on argv.
 *
 * Available commands:
 * - status [pkg...] - Show unreleased changes
 * - plan <type>     - Generate release plan (stable|preview|pr)
 * - apply           - Execute release plan
 * - render <format> - Render enriched plan data (comment|tree)
 * - log [pkg]       - Output changelog
 * - init            - Initialize release in project
 */
const commandsDir = Fs.Path.AbsDir.fromString(new URL('./commands/', import.meta.url).pathname)

const layer = Layer.merge(Env.Live, NodeFileSystem.layer)

Effect.runPromise(Effect.provide(Cli.dispatch(commandsDir), layer))
