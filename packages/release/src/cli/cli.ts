#!/usr/bin/env bun
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
 * - doctor          - Run release doctor checks and publishability audits
 * - forecast        - Render a release forecast
 * - plan            - Generate release plan (--lifecycle official|candidate|ephemeral)
 * - apply           - Execute release plan
 * - pr title ...    - Suggest or apply the canonical PR title header
 * - notes [pkg]     - Output release notes
 * - init            - Initialize release in project
 */
const commandsDir = Fs.Path.AbsDir.fromString(new URL('./commands/', import.meta.url).pathname)

const layer = Layer.merge(Env.Live, NodeFileSystem.layer)

void Effect.runPromise(Effect.provide(Cli.dispatch(commandsDir), layer))
