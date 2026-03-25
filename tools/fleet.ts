#!/usr/bin/env bun

// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { basename } from 'node:path'
import {
  defaultFleetBaseDir,
  renderMarkdownReport,
  renderTextReport,
  scanFleet,
  type FleetInventory,
} from './fleet-lib.js'

type CommandName = 'scan' | 'link'

interface ParsedArguments {
  readonly command: CommandName
  readonly baseDir: string
  readonly includeSelf: boolean
  readonly repoNames: readonly string[]
  readonly json: boolean
  readonly markdown: boolean
  readonly packages: readonly string[]
  readonly save: boolean
  readonly dryRun: boolean
}

const printUsage = (): void => {
  console.log(`Usage:
  bun tools/fleet.ts scan [--base-dir <path>] [--repo <name>] [--json | --markdown] [--include-self]
  bun tools/fleet.ts link [--base-dir <path>] [--repo <name>] [--package <name>] [--save] [--dry-run] [--include-self]`)
}

const parseArguments = (argv: readonly string[]): ParsedArguments => {
  const command = (argv[0] ?? 'scan') as CommandName
  if (command !== 'scan' && command !== 'link') {
    printUsage()
    process.exit(1)
  }

  let baseDir = defaultFleetBaseDir(process.cwd())
  let includeSelf = false
  let json = false
  let markdown = false
  let save = false
  let dryRun = false
  const repoNames: string[] = []
  const packages: string[] = []

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--base-dir': {
        const value = argv[index + 1]
        if (value) {
          baseDir = value
        }
        index += 1
        break
      }
      case '--repo': {
        const value = argv[index + 1]
        if (value) {
          repoNames.push(value)
        }
        index += 1
        break
      }
      case '--package': {
        const value = argv[index + 1]
        if (value) {
          packages.push(value)
        }
        index += 1
        break
      }
      case '--include-self': {
        includeSelf = true
        break
      }
      case '--json': {
        json = true
        break
      }
      case '--markdown': {
        markdown = true
        break
      }
      case '--save': {
        save = true
        break
      }
      case '--dry-run': {
        dryRun = true
        break
      }
      case '--no-save': {
        save = false
        break
      }
      case '--help':
      case '-h': {
        printUsage()
        process.exit(0)
      }
      default: {
        console.error(`Unknown argument: ${argument}`)
        printUsage()
        process.exit(1)
      }
    }
  }

  return {
    command,
    baseDir,
    includeSelf,
    repoNames,
    json,
    markdown,
    packages,
    save,
    dryRun,
  }
}

const getInventory = (arguments_: ParsedArguments): FleetInventory =>
  scanFleet(arguments_.baseDir, {
    includeSelf: arguments_.includeSelf,
    onlyRepoNames: arguments_.repoNames,
    selfRepoName: basename(process.cwd()),
  })

const renderInventory = (inventory: FleetInventory, arguments_: ParsedArguments): string => {
  if (arguments_.json) {
    return JSON.stringify(inventory, null, 2)
  }

  if (arguments_.markdown) {
    return renderMarkdownReport(inventory)
  }

  return renderTextReport(inventory)
}

const run = (
  command: readonly string[],
  cwd: string,
  options: { readonly dryRun?: boolean } = {},
): void => {
  const printable = `${cwd}$ ${command.join(' ')}`

  if (options.dryRun) {
    console.log(printable)
    return
  }

  console.log(printable)

  const result = spawnSync(command[0]!, command.slice(1), {
    cwd,
    // oxlint-disable-next-line kitz/domain/no-process-env
    env: process.env,
    stdio: 'inherit',
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

const linkFleet = (inventory: FleetInventory, arguments_: ParsedArguments): void => {
  const packageNames = arguments_.packages.length > 0 ? arguments_.packages : ['kitz']

  run(['bun', 'link'], process.cwd(), { dryRun: arguments_.dryRun })

  for (const entry of inventory.entries) {
    for (const packageName of packageNames) {
      const command = ['bun', 'link', packageName]

      if (!arguments_.save) {
        command.push('--no-save')
      }

      run(command, entry.repoPath, { dryRun: arguments_.dryRun })
    }
  }
}

const arguments_ = parseArguments(process.argv.slice(2))
const inventory = getInventory(arguments_)

if (arguments_.command === 'scan') {
  console.log(renderInventory(inventory, arguments_))
  process.exit(0)
}

linkFleet(inventory, arguments_)
