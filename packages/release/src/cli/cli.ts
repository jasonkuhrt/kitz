#!/usr/bin/env node
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect, Layer } from 'effect'
import { FileSystemLayer } from '../platform.js'

/**
 * Release CLI entry point.
 *
 * Uses file-based routing to dispatch commands from the `commands/` directory.
 * Each command is a separate module that gets dynamically imported based on argv.
 *
 * Available commands:
 * - doctor          - Run release doctor checks and publishability audits
 * - explain <pkg>   - Explain why a package is primary, cascade, or unchanged
 * - forecast        - Render a release forecast
 * - plan            - Generate release plan (--lifecycle official|candidate|ephemeral)
 * - apply           - Execute release plan
 * - graph           - Render the release execution DAG for the active plan
 * - resume          - Resume an interrupted release workflow
 * - status          - Inspect durable workflow state for the active plan
 * - pr ...          - Maintain the release preview comment or canonical PR title
 * - notes [pkg]     - Output release notes
 * - init            - Initialize release in project
 */
const commandsDir = Fs.Path.AbsDir.fromString(new URL('./commands/', import.meta.url).pathname)

const layer = Layer.merge(Env.Live, FileSystemLayer)

void Effect.runPromise(Effect.provide(Cli.dispatch(commandsDir), layer))
