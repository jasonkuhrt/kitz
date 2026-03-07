#!/usr/bin/env node
import { NodeFileSystem } from '@effect/platform-node'
import { NodeRuntime } from '@effect/platform-node'
import { Console, Effect } from 'effect'
import { run } from './run.js'

const args = process.argv.slice(2)

const parseArgs = (): { source: string; target: string } => {
  let source: string | undefined
  let target: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--source' && args[i + 1]) {
      source = args[++i]
    } else if (arg === '--target' && args[i + 1]) {
      target = args[++i]
    }
  }

  if (!source || !target) {
    console.error('Usage: doc-inject --source <markdown-file> --target <ts-directory>')
    process.exit(1)
  }

  return { source, target }
}

const { source, target } = parseArgs()

const program = Effect.gen(function* () {
  const modified = yield* run({ source, target })
  if (modified.length === 0) {
    yield* Console.log('No files were modified.')
  } else {
    yield* Console.log(`Modified ${modified.length} file(s):`)
    for (const filePath of modified) {
      yield* Console.log(`  ${filePath}`)
    }
  }
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeFileSystem.layer)))
